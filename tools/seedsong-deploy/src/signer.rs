use anyhow::{Context, Result, bail, ensure};
use ckb_sdk::traits::{Signer, SignerError};
use ckb_types::{bytes::Bytes, core::TransactionView};
use secp256k1::{
    Message, Secp256k1,
    ecdsa::{RecoverableSignature, RecoveryId},
};
use std::{
    io::{Read, Write},
    path::PathBuf,
    process::{Command, Stdio},
};

/// Sign through ckb-cli's keystore. Private keys never enter this process.
pub struct CliSigner {
    pub account: [u8; 20],
    pub executable: PathBuf,
    pub home: Option<PathBuf>,
}
impl Signer for CliSigner {
    fn match_id(&self, id: &[u8]) -> bool {
        id == self.account
    }
    fn sign(
        &self,
        id: &[u8],
        message: &[u8],
        recoverable: bool,
        _: &TransactionView,
    ) -> Result<Bytes, SignerError> {
        if !self.match_id(id) {
            return Err(SignerError::IdNotFound);
        }
        if message.len() != 32 || !recoverable {
            return Err(SignerError::InvalidMessage(
                "Expected a recoverable 32-byte sighash".into(),
            ));
        }
        self.sign_message(message)
            .map(Bytes::from)
            .map_err(SignerError::Other)
    }
}
impl CliSigner {
    fn sign_message(&self, message: &[u8]) -> Result<Vec<u8>> {
        let mut command = Command::new(&self.executable);
        command
            .args([
                "--local-only",
                "--no-color",
                "--output-format",
                "json",
                "util",
                "sign-message",
                "--from-account",
            ])
            .arg(format!("0x{}", hex::encode(self.account)))
            .arg("--message")
            .arg(format!("0x{}", hex::encode(message)))
            .arg("--recoverable")
            .stdin(Stdio::inherit())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit());
        if let Some(home) = &self.home {
            command.env("CKB_CLI_HOME", home);
        }
        eprintln!(
            "Signing with ckb-cli account 0x{} (enter its password if prompted).",
            hex::encode(self.account)
        );
        let mut child = command
            .spawn()
            .context("Could not start ckb-cli; install it or set --ckb-cli")?;
        let mut output = Vec::new();
        let result = (|| -> Result<()> {
            let mut stdout = child.stdout.take().context("Missing ckb-cli stdout")?;
            let mut buffer = [0; 4096];
            loop {
                let n = stdout.read(&mut buffer)?;
                if n == 0 {
                    break;
                }
                // Old ckb-cli versions print the password prompt to stdout.
                // Forward it while capturing the public JSON signature result.
                std::io::stderr().write_all(&buffer[..n])?;
                std::io::stderr().flush()?;
                ensure!(output.len() + n <= 65536, "ckb-cli output exceeded 64 KiB");
                output.extend_from_slice(&buffer[..n]);
            }
            Ok(())
        })();
        if result.is_err() {
            let _ = child.kill();
        }
        let status = child.wait()?;
        result?;
        ensure!(status.success(), "ckb-cli signing failed ({status})");
        let signature = parse_signature(&output)?;
        verify_signature(message, &signature, &self.account)?;
        Ok(signature)
    }
}
fn parse_signature(output: &[u8]) -> Result<Vec<u8>> {
    let start = output
        .iter()
        .position(|b| *b == b'{')
        .context("ckb-cli returned no JSON signature")?;
    let value: serde_json::Value =
        serde_json::from_slice(&output[start..]).context("Invalid ckb-cli JSON output")?;
    let signature = value
        .get("signature")
        .and_then(|v| v.as_str())
        .context("ckb-cli result has no signature")?;
    let bytes = hex::decode(signature.strip_prefix("0x").unwrap_or(signature))
        .context("Invalid signature hex")?;
    ensure!(
        bytes.len() == 65,
        "ckb-cli must return a 65-byte recoverable signature"
    );
    Ok(bytes)
}
fn verify_signature(message: &[u8], signature: &[u8], expected: &[u8; 20]) -> Result<()> {
    ensure!(signature.len() == 65, "Invalid signature length");
    let recovery = RecoveryId::try_from(i32::from(signature[64]))?;
    let signature = RecoverableSignature::from_compact(&signature[..64], recovery)?;
    let message = Message::from_digest_slice(message)?;
    let public = Secp256k1::new().recover_ecdsa(&message, &signature)?;
    if &ckb_hash::blake2b_256(public.serialize())[..20] != expected {
        bail!("ckb-cli signature does not match --from address");
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn prompts_and_signature_verification() {
        let key = secp256k1::SecretKey::from_slice(&[1; 32]).unwrap();
        let ctx = Secp256k1::new();
        let public = secp256k1::PublicKey::from_secret_key(&ctx, &key);
        let account: [u8; 20] = ckb_hash::blake2b_256(public.serialize())[..20]
            .try_into()
            .unwrap();
        let digest = [7; 32];
        let signature =
            ctx.sign_ecdsa_recoverable(&Message::from_digest_slice(&digest).unwrap(), &key);
        let (id, compact) = signature.serialize_compact();
        let mut bytes = compact.to_vec();
        bytes.push(i32::from(id) as u8);
        let output = format!(
            "Password: {{\"signature\":\"0x{}\",\"recoverable\":true}}\n",
            hex::encode(&bytes)
        );
        let parsed = parse_signature(output.as_bytes()).unwrap();
        verify_signature(&digest, &parsed, &account).unwrap();
        assert!(verify_signature(&[8; 32], &parsed, &account).is_err());
        assert!(parse_signature(b"Password: failed").is_err());
        assert!(parse_signature(b"{\"signature\":\"0x00\"}").is_err());
    }
}
