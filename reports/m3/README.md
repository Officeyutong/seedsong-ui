# M3 acceptance evidence

Status: **incomplete**. The chain/content checks below passed. This is not yet a
complete browser end-to-end acceptance result.

## Confirmed mint

- Transaction: [0xdedf5a49e058b8825ddb638aecbdb87a03afb04b4515d3dfde7483e0651374c4](https://testnet.explorer.nervos.org/transaction/0xdedf5a49e058b8825ddb638aecbdb87a03afb04b4515d3dfde7483e0651374c4)
- Observed status: `committed`, block **23072993**, output **1**.
- Spore ID: `0xcf2aacb81ebbab7112316a2c485e6bb33abbcf1ee502dd629e5f60d914fb5cd0`.
- Cluster ID: `0xcac704319425b5ba589b62fb4df55307909c77db8a9ee5ead5d3e8bfaaa27abe`.
- Content type: `dob/1`; valid 32-byte DNA in JSON content.
- DNA: `5fd7b23f4e2b571e8a556be689153374f3cdecf64cf551ded800f165dfcd934f`.

The user supplied this transaction after reporting a successful test. Its inclusion
was independently checked through a read-only public testnet JSON-RPC diagnostic.
This does not independently establish how the browser signed or broadcast it.
The application has not been given an RPC fallback.

## Executed content checks

The deployed decoder transaction at
`0x4d54a43844847bd053b8cedf6bf70deb5cdb5904a43378f6db7c4426887a22ba:0`
was fetched separately by the diagnostic. The archive is 159758 bytes. The actual
ZIP was checked with the application's `unpackDecoder`, including its ABI, file
manifest and hashes, then its own loader instantiated its own WASM. The bundled
music decoder was not substituted.

Using the DNA extracted from the minted Spore, that decoder:

- decoded DOB/0 traits and generated the DOB/1 SVG using the archived patterns;
- produced a 797-byte SVG, saved as `minted-cover.svg`;
- rendered music v2 as a PCM16 stereo WAV at 22050 Hz;
- produced 3113348 WAV bytes, about 35.30 seconds, with nonzero PCM samples.

`mint-verification.json` records the check time, exact chain references, archive,
WASM, SVG and WAV hashes, and explicit passed/unverified check statuses. WAV bytes
were generated locally for validation but are not checked into this repository.
Successful PCM generation is not evidence that a browser played the audio.

## Remaining browser acceptance

Run against the actual deployed build and record its URL and source revision.
Use a browser with the wallet configured; do not share private keys or seed words.

1. Open DevTools Network before loading the page. Enable Preserve log and inspect
   Worker traffic too. Record the clean browser/profile and configured scan height.
2. Load the decoder from its Cell, not the bundled fallback. Confirm the selected
   OutPoint and archive hash match the evidence JSON.
3. Connect a funded ordinary testnet wallet. Mint a record and approve its signature
   in the wallet. Record the hash, then wait until the UI reports verified
   `committed` status, rather than local `queued` status.
4. In the gallery, reload the wallet's records from chain data, locate the confirmed
   Spore, and compare its DNA, Cluster and cover. Gallery is now implemented as a
   separate tab; this browser acceptance step has not yet been observed. A local
   mint receipt is not a substitute.
5. Play that record and verify that the audio actually advances and is audible.
6. Export Network evidence and application logs. Check that application chain reads,
   decoder loading and transaction broadcast use WSS P2P, with no HTTP RPC,
   indexer or remote DOB decoding. Check method/payload as well as hostname:
   same-origin HTTP is not automatically a static file request. Report any wallet
   authentication traffic separately; do not silently classify it as P2P.
7. Repeat after a page reload so local receipt state is not the sole source of the
   displayed asset. Add URL/revision, confirmation, playback and Network evidence
   to this report before changing its overall status to passed.

This session had no interactive browser/display attached. Browser playback,
Network evidence, and wallet interactions were not independently observed.
