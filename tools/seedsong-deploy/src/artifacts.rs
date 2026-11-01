use anyhow::{Context, Result, ensure};
use ckb_types::{
    bytes::Bytes,
    core::Capacity,
    packed::{CellOutput, Script},
    prelude::*,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs,
    io::{Cursor, Read, Write},
    path::{Path, PathBuf},
};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveFile {
    pub name: String,
    pub bytes: usize,
    pub sha256: String,
    pub data_hash: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub name: String,
    pub index: u32,
    pub bytes: usize,
    pub sha256: String,
    pub data_hash: String,
    pub capacity_shannons: u64,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub archive_files: Vec<ArchiveFile>,
}
pub struct Artifact {
    pub info: FileInfo,
    pub data: Bytes,
    pub output: CellOutput,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub schema: &'static str,
    pub network: String,
    pub owner_address: String,
    pub files: Vec<FileInfo>,
    pub total_capacity_shannons: u64,
    pub total_capacity_ckb: String,
    pub note: &'static str,
}
pub fn ckb(shannons: u64) -> String {
    format!("{}.{:08}", shannons / 100_000_000, shannons % 100_000_000)
}
pub fn sha256(data: &[u8]) -> String {
    hex::encode(Sha256::digest(data))
}
pub fn data_hash(data: &[u8]) -> String {
    format!("0x{}", hex::encode(ckb_hash::blake2b_256(data)))
}
fn artifact(name: String, data: Vec<u8>, index: usize, owner: &Script) -> Result<Artifact> {
    ensure!(!data.is_empty(), "{name} is empty");
    let output = CellOutput::new_builder().lock(owner.clone()).build();
    let capacity = output
        .occupied_capacity(Capacity::bytes(data.len())?)?
        .as_u64();
    let output = output.as_builder().capacity(capacity).build();
    Ok(Artifact {
        info: FileInfo {
            name,
            index: u32::try_from(index)?,
            bytes: data.len(),
            sha256: sha256(&data),
            data_hash: data_hash(&data),
            capacity_shannons: capacity,
            archive_files: Vec::new(),
        },
        data: Bytes::from(data),
        output,
    })
}
pub fn load(
    base: &Path,
    no_defaults: bool,
    extra: &[(String, PathBuf)],
    owner: &Script,
) -> Result<Vec<Artifact>> {
    let mut inputs = Vec::new();
    let mut abi_version = None;
    if !no_defaults {
        let dist = base.join("wasm/seedsong-js/dist");
        for name in ["decoder.wasm", "loader.js", "decoder.json"] {
            inputs.push((name.to_owned(), dist.join(name)));
        }
        for name in ["spec.md", "spec-v1.md", "pattern.md"] {
            inputs.push((name.to_owned(), base.join(name)));
        }
    }
    inputs.extend_from_slice(extra);
    ensure!(
        !inputs.is_empty(),
        "No files selected; supply --file NAME=PATH or enable the default bundle"
    );
    let mut names = HashSet::new();
    let mut files = Vec::new();
    for (name, path) in inputs {
        ensure!(
            !name.is_empty()
                && name
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b)),
            "Invalid artifact name {name:?}; use letters, digits, dot, dash or underscore"
        );
        ensure!(
            !matches!(name.as_str(), "bundle.json" | "bundle.zip") && names.insert(name.clone()),
            "Duplicate or reserved artifact name: {name}"
        );
        let data = fs::read(&path).with_context(|| {
            format!(
                "Cannot read {}. For the default bundle, build seedsong-js first",
                path.display()
            )
        })?;
        files.push(artifact(name, data, files.len(), owner)?);
    }
    if !no_defaults {
        let wasm = &files[0].data;
        ensure!(
            wasm.starts_with(b"\0asm\x01\0\0\0"),
            "decoder.wasm is not a version-1 WASM binary"
        );
        let manifest: serde_json::Value = serde_json::from_slice(&files[2].data)?;
        ensure!(
            manifest["wasmBytes"].as_u64() == Some(wasm.len() as u64),
            "decoder.json byte count does not match decoder.wasm; rebuild the bundle"
        );
        ensure!(
            manifest["sha256"].as_str() == Some(sha256(wasm).as_str()),
            "decoder.json hash does not match decoder.wasm; rebuild the bundle"
        );
        abi_version = Some(
            manifest["abiVersion"]
                .as_u64()
                .context("decoder.json is missing abiVersion")?,
        );
    }
    let mut archive_files: Vec<_> = files
        .iter()
        .map(|file| ArchiveFile {
            name: file.info.name.clone(),
            bytes: file.data.len(),
            sha256: file.info.sha256.clone(),
            data_hash: file.info.data_hash.clone(),
        })
        .collect();
    // Archive entries are located by name, not Cell output index. The manifest
    // omits its own hash; the receipt covers the complete ZIP and every entry.
    let manifest = serde_json::json!({
        "schema": "seedsong-archive/1", "decoderAbiVersion": abi_version,
        "files": archive_files,
    });
    let manifest_bytes = serde_json::to_vec_pretty(&manifest)?;
    archive_files.push(ArchiveFile {
        name: "bundle.json".into(),
        bytes: manifest_bytes.len(),
        sha256: sha256(&manifest_bytes),
        data_hash: data_hash(&manifest_bytes),
    });
    let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .compression_level(Some(9))
        .last_modified_time(zip::DateTime::default())
        .unix_permissions(0o644);
    for file in files {
        writer.start_file(file.info.name, options)?;
        writer.write_all(&file.data)?;
    }
    writer.start_file("bundle.json", options)?;
    writer.write_all(&manifest_bytes)?;
    let data = writer.finish()?.into_inner();
    let mut archive = artifact("bundle.zip".into(), data, 0, owner)?;
    archive.info.archive_files = archive_files;
    Ok(vec![archive])
}

/// Check archive contents without writing extracted files to the filesystem.
pub fn verify_archive(data: &[u8], entries: &[ArchiveFile]) -> Result<()> {
    let mut archive = zip::ZipArchive::new(Cursor::new(data))?;
    ensure!(
        archive.len() == entries.len(),
        "ZIP entry count differs from receipt"
    );
    let mut names = HashSet::new();
    for entry in entries {
        ensure!(names.insert(&entry.name), "Duplicate receipt archive entry");
        let file = archive.by_name(&entry.name)?;
        ensure!(
            file.size() == entry.bytes as u64,
            "ZIP size mismatch for {}",
            entry.name
        );
        let mut bytes = Vec::new();
        file.take(
            (entry.bytes as u64)
                .checked_add(1)
                .context("ZIP entry size overflow")?,
        )
        .read_to_end(&mut bytes)?;
        ensure!(
            bytes.len() == entry.bytes
                && sha256(&bytes) == entry.sha256
                && data_hash(&bytes) == entry.data_hash,
            "ZIP content hash mismatch for {}",
            entry.name
        );
    }
    Ok(())
}

pub fn plan(files: &[Artifact], owner: String, network: String) -> Result<Plan> {
    let total = files.iter().try_fold(0u64, |sum, file| {
        sum.checked_add(file.info.capacity_shannons)
            .context("Capacity overflow")
    })?;
    Ok(Plan {
        schema: "seedsong-deployment-plan/2",
        network,
        owner_address: owner,
        files: files.iter().map(|f| f.info.clone()).collect(),
        total_capacity_shannons: total,
        total_capacity_ckb: ckb(total),
        note: "Occupied capacity only; transaction fees and change are calculated during deploy. No transaction has been sent.",
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cell_capacity_accounts_for_all_data_and_lock_bytes() {
        let owner = Script::new_builder()
            .args(Bytes::from(vec![0; 20]).pack())
            .build();
        let file = artifact("test".into(), vec![1; 100], 0, &owner).unwrap();
        assert_eq!(file.info.capacity_shannons, 161 * 100_000_000);
        assert_eq!(file.info.sha256.len(), 64);
        assert_eq!(file.info.data_hash.len(), 66);
        assert_eq!(ckb(123456789), "1.23456789");
        assert!(artifact("empty".into(), vec![], 0, &owner).is_err());
    }
    #[test]
    fn bundle_manifest_integrity_and_duplicate_names() {
        let temp = tempfile::tempdir().unwrap();
        let base = temp.path();
        let dist = base.join("wasm/seedsong-js/dist");
        fs::create_dir_all(&dist).unwrap();
        let wasm = b"\0asm\x01\0\0\0";
        fs::write(dist.join("decoder.wasm"), wasm).unwrap();
        fs::write(dist.join("loader.js"), "export {};\n").unwrap();
        let manifest =
            serde_json::json!({ "abiVersion": 1, "wasmBytes": wasm.len(), "sha256": sha256(wasm) });
        fs::write(
            dist.join("decoder.json"),
            serde_json::to_vec(&manifest).unwrap(),
        )
        .unwrap();
        for name in ["spec.md", "spec-v1.md", "pattern.md"] {
            fs::write(base.join(name), "fixture").unwrap();
        }
        let lock = Script::new_builder()
            .args(Bytes::from(vec![0; 20]).pack())
            .build();
        let files = load(base, false, &[], &lock).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].info.name, "bundle.zip");
        assert_eq!(files[0].info.index, 0);
        assert_eq!(files[0].info.archive_files.len(), 7);
        verify_archive(&files[0].data, &files[0].info.archive_files).unwrap();
        let repeated = load(base, false, &[], &lock).unwrap();
        assert_eq!(
            files[0].data, repeated[0].data,
            "ZIP metadata must be deterministic"
        );
        let mut archive = zip::ZipArchive::new(Cursor::new(&files[0].data)).unwrap();
        let mut manifest = String::new();
        archive
            .by_name("bundle.json")
            .unwrap()
            .read_to_string(&mut manifest)
            .unwrap();
        let bundle: serde_json::Value = serde_json::from_str(&manifest).unwrap();
        assert_eq!(bundle["schema"], "seedsong-archive/1");
        assert_eq!(bundle["files"].as_array().unwrap().len(), 6);
        assert!(bundle["files"][0].get("index").is_none());
        assert!(bundle["files"][0].get("capacityShannons").is_none());
        let mut tampered = files[0].info.archive_files.clone();
        tampered[0].sha256 = "wrong".into();
        assert!(verify_archive(&files[0].data, &tampered).is_err());
        assert!(
            load(
                base,
                false,
                &[("decoder.wasm".into(), dist.join("decoder.wasm"))],
                &lock
            )
            .is_err()
        );
        assert!(
            load(
                base,
                true,
                &[("bundle.json".into(), dist.join("decoder.wasm"))],
                &lock
            )
            .is_err()
        );
        fs::write(dist.join("decoder.wasm"), b"\0asm\x01\0\0\0changed").unwrap();
        assert!(load(base, false, &[], &lock).is_err());
    }
}
