import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Divider,
    Link,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
    useTheme,
} from "@mui/material";
import BusyButton from "../common/BusyButton";
import { download, nextPaint } from "../common/download";
import { DEFAULT_SETTINGS } from "../decoder/types";
import type { DecoderSession } from "../decoder/engine";
import {
    CLUSTER_ID,
    CLUSTER_TYPE_HASH,
    MAX_BATCH,
    checkMint,
    generateBatchDna,
    normalizeDnas,
    prepareMint,
    readMintHistory,
    requireTestnet,
    resubmitMint,
    saveMintReceipt,
    signAndSubmitMint,
} from "./api";
import type { MintPlan, MintReceipt } from "./api";
interface Props {
    dna: string;
    onDnaChange: (dna: string) => void;
    decoder: DecoderSession | null;
    sourceBusy: boolean;
    onBusy: (busy: boolean) => void;
}
function openClient() {
    return ccc.ClientPublicTestnet.open({ urls: [DEFAULT_SETTINGS.rpcUrl], timeout: 30_000 });
}
export default function MintView(props: Props) {
    const [owner, setOwner] = useState<ReturnType<typeof openClient> | null>(null);
    const theme = useTheme();
    useEffect(() => {
        const resource = openClient();
        let active = true;
        void Promise.resolve().then(() => {
            if (active) setOwner(resource);
        });
        return () => {
            active = false;
            void resource.dispose();
        };
    }, []);
    return owner ? (
        <ccc.Provider
            name="Seedsong"
            defaultClient={owner.value}
            clientOptions={[{ name: "CKB Testnet", client: owner.value }]}
            connectorProps={{
                style: {
                    zIndex: 1500,
                    color: theme.palette.text.primary,
                    "--background": theme.palette.background.paper,
                } as CSSProperties,
            }}
        >
            <MintStudio {...props} />
        </ccc.Provider>
    ) : (
        <Box sx={{ p: 6, textAlign: "center" }}>
            <CircularProgress aria-label="Loading wallet connector" />
        </Box>
    );
}
function amount(value: bigint | string) {
    return ccc.fixedPointToString(BigInt(value));
}
function Records({ records }: { records: { dna: string; sporeId: string }[] }) {
    return (
        <TableContainer sx={{ maxHeight: 330 }}>
            <Table size="small" stickyHeader aria-label="Mint record list">
                <TableHead>
                    <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>DNA</TableCell>
                        <TableCell>Spore ID</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {records.map((record, index) => (
                        <TableRow key={record.sporeId}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell
                                sx={{
                                    fontFamily: "var(--mono)",
                                    fontSize: 11,
                                    overflowWrap: "anywhere",
                                    minWidth: 180,
                                }}
                            >
                                {record.dna}
                            </TableCell>
                            <TableCell
                                sx={{
                                    fontFamily: "var(--mono)",
                                    fontSize: 11,
                                    overflowWrap: "anywhere",
                                    minWidth: 180,
                                }}
                            >
                                {record.sporeId}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}
function MintStudio({ dna, onDnaChange, decoder, sourceBusy, onBusy }: Props) {
    const { open, close, disconnect, client, signerInfo, wallet, isOpen, setClient } = ccc.useCcc();
    const signer = signerInfo?.signer;
    const [mode, setMode] = useState<"single" | "batch">("single");
    const [count, setCount] = useState(50);
    const [batch, setBatch] = useState("");
    const [feeRate, setFeeRate] = useState("1000");
    const [rpc, setRpc] = useState(client.url);
    const [phase, setPhase] = useState("");
    const [progress, setProgress] = useState("");
    const [error, setError] = useState("");
    const [preview, setPreview] = useState<{ key: string; plan: MintPlan } | null>(null);
    const [journal, setJournal] = useState(() => {
        try {
            return { entries: readMintHistory(), error: "" };
        } catch (error) {
            return { entries: [] as MintReceipt[], error: (error as Error).message };
        }
    });
    const [account, setAccount] = useState<{ signer: ccc.Signer; address: string } | null>(null);
    const identity = useRef({ signer, client });
    const inflight = useRef(false);
    const controller = useRef<AbortController | null>(null);
    const busy = !!phase;
    useEffect(() => {
        identity.current = { signer, client };
    }, [signer, client]);
    useEffect(() => {
        let active = true;
        if (signer)
            void signer
                .getRecommendedAddress()
                .then((address) => {
                    if (active) setAccount({ signer, address });
                })
                .catch(() => {});
        return () => {
            active = false;
        };
    }, [signer]);
    useEffect(
        () => () => {
            controller.current?.abort();
            onBusy(false);
        },
        [onBusy],
    );
    let dnas: string[] = [];
    let validation = "";
    try {
        dnas = normalizeDnas(
            mode === "single"
                ? [dna]
                : batch
                      .split(/\r?\n/)
                      .map((line) => line.trim())
                      .filter(Boolean),
        );
    } catch (error) {
        validation = (error as Error).message;
    }
    const key = JSON.stringify([mode, dnas, feeRate, decoder?.id]);
    const plan =
        preview?.key === key && preview.plan.signer === signer && preview.plan.client === client
            ? preview.plan
            : null;
    const recorded =
        !!plan &&
        journal.entries.some(
            (entry) => entry.txHash === plan.txHash && entry.status !== "rejected",
        );
    async function run(name: string, task: (signal: AbortSignal) => Promise<void>) {
        if (inflight.current) return;
        inflight.current = true;
        onBusy(true);
        setPhase(name);
        setProgress("");
        setError("");
        const abort = new AbortController();
        controller.current = abort;
        try {
            await task(abort.signal);
        } catch (error) {
            if ((error as Error).name !== "AbortError")
                setError(error instanceof Error ? error.message : "Mint operation failed.");
        } finally {
            controller.current = null;
            inflight.current = false;
            setPhase("");
            setProgress("");
            onBusy(false);
        }
    }
    const update = (receipt: MintReceipt) =>
        setJournal((previous) => ({
            ...previous,
            entries: [
                receipt,
                ...previous.entries.filter((entry) => entry.txHash !== receipt.txHash),
            ],
        }));
    const submitOptions = { persist: saveMintReceipt, onUpdate: update, onProgress: setProgress };
    const exportJson = (value: unknown, name: string) =>
        run(`export-${name}`, async () => {
            await nextPaint();
            download(JSON.stringify(value, null, 2), "application/json", name);
        });
    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Stack spacing={3}>
                <Box>
                    <Typography variant="h4">Mint your records</Typography>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                        One DNA per record. Your wallet signs; private keys stay in your wallet.
                    </Typography>
                </Box>
                <Paper variant="outlined" sx={{ p: 3 }}>
                    <Stack spacing={2}>
                        <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            sx={{ flexWrap: "wrap", alignItems: "center" }}
                        >
                            <Chip label="CKB Testnet" color="primary" variant="outlined" />
                            <BusyButton
                                variant="contained"
                                disabled={busy}
                                busy={isOpen}
                                busyLabel="Choose a wallet…"
                                onClick={() => open()}
                            >
                                {wallet ? `Wallet: ${wallet.name}` : "Connect wallet"}
                            </BusyButton>
                            {isOpen && <Button onClick={() => close()}>Close wallet picker</Button>}
                            {wallet && (
                                <BusyButton
                                    busy={phase === "disconnect"}
                                    disabled={busy}
                                    onClick={() =>
                                        void run("disconnect", async () => {
                                            await Promise.resolve(disconnect());
                                            setPreview(null);
                                        })
                                    }
                                >
                                    Disconnect
                                </BusyButton>
                            )}
                        </Stack>
                        {signer && (
                            <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                                {account?.signer === signer
                                    ? account.address
                                    : "Reading wallet address…"}
                            </Typography>
                        )}
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <TextField
                                fullWidth
                                label="Minting RPC endpoint"
                                value={rpc}
                                disabled={busy}
                                onChange={(e) => setRpc(e.target.value)}
                                helperText={`Active RPC: ${client.url}`}
                            />
                            <BusyButton
                                busy={phase === "rpc"}
                                disabled={busy || isOpen}
                                onClick={() =>
                                    void run("rpc", async () => {
                                        const url = new URL(rpc.trim());
                                        if (!["http:", "https:"].includes(url.protocol))
                                            throw new Error("Use an HTTP or HTTPS RPC URL.");
                                        const resource = ccc.ClientPublicTestnet.open({
                                            urls: [url.href],
                                            timeout: 30_000,
                                        });
                                        try {
                                            await requireTestnet(resource.value);
                                            setClient(resource);
                                            setPreview(null);
                                        } catch (error) {
                                            await resource.dispose();
                                            throw error;
                                        }
                                    })
                                }
                            >
                                Apply RPC
                            </BusyButton>
                        </Stack>
                        <Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>
                            Cluster: {CLUSTER_ID}
                        </Typography>
                        <Alert severity="info">
                            Public minting is enabled. Connect any funded CKB testnet wallet to mint
                            your records. You pay the record capacity and network fee; no creator
                            signature or extra minting fee is required. Records use the Cluster’s
                            music v2 release; playback overrides are not stored.
                        </Alert>
                    </Stack>
                </Paper>
                <Paper variant="outlined" sx={{ p: 3 }}>
                    <Stack spacing={2}>
                        <ToggleButtonGroup
                            exclusive
                            value={mode}
                            onChange={(_, value) => {
                                if (value) setMode(value);
                            }}
                            disabled={busy}
                        >
                            <ToggleButton value="single">Current DNA</ToggleButton>
                            <ToggleButton value="batch">Batch mint</ToggleButton>
                        </ToggleButtonGroup>
                        {mode === "single" ? (
                            <TextField
                                multiline
                                minRows={2}
                                label="DNA to mint"
                                value={dna}
                                disabled={busy}
                                onChange={(e) => onDnaChange(e.target.value)}
                                helperText="32 bytes, or 64 hexadecimal characters."
                            />
                        ) : (
                            <>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                    <TextField
                                        type="number"
                                        label="Batch size"
                                        value={count}
                                        disabled={busy}
                                        onChange={(e) => setCount(Number(e.target.value))}
                                        slotProps={{
                                            htmlInput: { min: 1, max: MAX_BATCH, step: 1 },
                                        }}
                                    />
                                    <BusyButton
                                        variant="outlined"
                                        busy={phase === "generate"}
                                        busyLabel={progress || "Generating DNA…"}
                                        disabled={busy || sourceBusy || !decoder}
                                        onClick={() =>
                                            void run("generate", async (signal) => {
                                                const generated = await generateBatchDna(count, {
                                                    signal,
                                                    randomDna: decoder
                                                        ? () => decoder.engine.randomDna()
                                                        : undefined,
                                                    onProgress: setProgress,
                                                });
                                                setBatch(generated.join("\n"));
                                            })
                                        }
                                    >
                                        Generate random DNA
                                    </BusyButton>
                                </Stack>
                                <TextField
                                    multiline
                                    minRows={5}
                                    maxRows={12}
                                    label="Batch DNA list"
                                    value={batch}
                                    disabled={busy}
                                    onChange={(e) => setBatch(e.target.value)}
                                    helperText={`One DNA per line. Up to ${MAX_BATCH} unique records in one transaction.`}
                                />
                            </>
                        )}
                        {validation && (
                            <Typography variant="body2" color="text.secondary">
                                {validation}
                            </Typography>
                        )}
                        <TextField
                            select
                            label="Fee rate"
                            value={feeRate}
                            disabled={busy}
                            onChange={(e) => setFeeRate(e.target.value)}
                        >
                            {[1000, 2000, 5000].map((value) => (
                                <MenuItem key={value} value={String(value)}>
                                    {value} shannons / 1000 bytes
                                </MenuItem>
                            ))}
                        </TextField>
                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                            <BusyButton
                                variant="contained"
                                busy={phase === "prepare"}
                                busyLabel={progress || "Preparing mint…"}
                                disabled={
                                    busy ||
                                    !!validation ||
                                    !signer ||
                                    !decoder ||
                                    sourceBusy ||
                                    isOpen
                                }
                                onClick={() =>
                                    void run("prepare", async (signal) => {
                                        if (!signer || !decoder) return;
                                        if (signer.client !== client)
                                            throw new Error(
                                                "Reconnect your wallet to the selected RPC before preparing.",
                                            );
                                        const result = await prepareMint(
                                            signer,
                                            dnas,
                                            decoder.info.package.reference,
                                            {
                                                signal,
                                                feeRate: BigInt(feeRate),
                                                onProgress: setProgress,
                                            },
                                        );
                                        setPreview({ key, plan: result });
                                    })
                                }
                            >
                                Prepare {dnas.length || ""} record{dnas.length === 1 ? "" : "s"}
                            </BusyButton>
                            <BusyButton
                                busy={phase === "export-seedsong-dnas.json"}
                                disabled={busy || !!validation}
                                onClick={() =>
                                    void exportJson(
                                        {
                                            schema: "seedsong-dna-batch/1",
                                            clusterId: CLUSTER_ID,
                                            dnas,
                                        },
                                        "seedsong-dnas.json",
                                    )
                                }
                            >
                                Export DNA list
                            </BusyButton>
                            {(phase === "generate" || phase === "prepare") && (
                                <Button onClick={() => controller.current?.abort()}>Cancel</Button>
                            )}
                        </Stack>
                        {!decoder && (
                            <Alert severity="info">
                                Load a decoder source before preparing a mint.
                            </Alert>
                        )}
                        {sourceBusy && (
                            <Typography variant="caption">
                                Wait for the decoder source to finish loading.
                            </Typography>
                        )}
                        {error && (
                            <Alert severity="error" onClose={() => setError("")}>
                                {error}
                            </Alert>
                        )}
                        {journal.error && (
                            <Alert severity="error">
                                {journal.error} Minting is disabled until receipt storage is
                                available.
                            </Alert>
                        )}
                    </Stack>
                </Paper>
                {plan && (
                    <Paper variant="outlined" sx={{ p: 3 }}>
                        <Stack spacing={2}>
                            <Typography variant="h6">Review before signing</Typography>
                            <Chip
                                label={
                                    plan.publicProof
                                        ? "Public mint · Any wallet"
                                        : "Owner-authorized mint"
                                }
                                color="primary"
                                variant="outlined"
                            />
                            <Typography>
                                {plan.records.length} records · {amount(plan.recordCapacity)} CKB
                                locked in records · {amount(plan.fee)} CKB fee
                            </Typography>
                            <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                                Recipient: {plan.recipient}
                            </Typography>
                            <Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>
                                Collection authorization address: {plan.clusterOwner}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                All records are minted atomically in one transaction. The public
                                authorization Cell is returned with its full capacity. If another
                                mint uses it first, prepare a fresh transaction.
                            </Typography>
                            <Records records={plan.records} />
                            <BusyButton
                                variant="contained"
                                busy={phase === "sign"}
                                busyLabel={progress || "Waiting for wallet…"}
                                disabled={
                                    busy || isOpen || sourceBusy || !!journal.error || recorded
                                }
                                onClick={() =>
                                    void run("sign", async () => {
                                        if (
                                            readMintHistory().some(
                                                (entry) =>
                                                    entry.txHash === plan.txHash &&
                                                    entry.status !== "rejected",
                                            )
                                        )
                                            throw new Error(
                                                "This transaction is already saved. Check its status below instead of minting again.",
                                            );
                                        await signAndSubmitMint(plan, {
                                            ...submitOptions,
                                            isCurrent: () =>
                                                identity.current.signer === plan.signer &&
                                                identity.current.client === plan.client,
                                        });
                                    })
                                }
                            >
                                Sign and mint {plan.records.length} record
                                {plan.records.length === 1 ? "" : "s"}
                            </BusyButton>
                            {recorded && (
                                <Alert severity="info">
                                    This mint already has a saved receipt. Use its status and
                                    recovery controls below.
                                </Alert>
                            )}
                        </Stack>
                    </Paper>
                )}
                <Divider />
                <Stack
                    direction="row"
                    sx={{ justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}
                >
                    <Typography variant="h6">Mint receipts</Typography>
                    <BusyButton
                        busy={phase === "export-seedsong-mints.json"}
                        disabled={busy || !journal.entries.length}
                        onClick={() => void exportJson(journal.entries, "seedsong-mints.json")}
                    >
                        Export all receipts
                    </BusyButton>
                </Stack>
                {!journal.entries.length && (
                    <Typography color="text.secondary">
                        No signed mint transactions saved in this browser yet.
                    </Typography>
                )}
                {journal.entries.slice(0, 20).map((receipt) => (
                    <Paper key={receipt.txHash} variant="outlined" sx={{ p: 3 }}>
                        <Stack spacing={2}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                <Chip
                                    label={receipt.status}
                                    color={receipt.status === "committed" ? "success" : "default"}
                                />
                                <Typography variant="body2">
                                    {receipt.records.length} records
                                </Typography>
                            </Stack>
                            <Link
                                href={`https://testnet.explorer.nervos.org/transaction/${receipt.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                sx={{ overflowWrap: "anywhere" }}
                            >
                                {receipt.txHash}
                            </Link>
                            <Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>
                                RPC: {receipt.rpcUrl}
                            </Typography>
                            {receipt.message && (
                                <Alert severity={receipt.status === "rejected" ? "error" : "info"}>
                                    {receipt.message}
                                </Alert>
                            )}
                            {(receipt.status === "signed" || receipt.status === "unknown") && (
                                <Typography variant="body2">
                                    Check status before retrying. Recovery resends the exact signed
                                    transaction and cannot create another batch.
                                </Typography>
                            )}
                            <Records records={receipt.records} />
                            {receipt.status === "committed" && (
                                <Link
                                    href={`https://testnet.explorer.nervos.org/nft-info/${CLUSTER_TYPE_HASH}/${receipt.records[0].sporeId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    View first record in Explorer
                                </Link>
                            )}
                            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                                <BusyButton
                                    busy={phase === `check-${receipt.txHash}`}
                                    disabled={busy}
                                    onClick={() =>
                                        void run(`check-${receipt.txHash}`, async () => {
                                            const next = await checkMint(receipt);
                                            saveMintReceipt(next);
                                            update(next);
                                        })
                                    }
                                >
                                    Check transaction status
                                </BusyButton>
                                {(receipt.status === "signed" || receipt.status === "unknown") && (
                                    <BusyButton
                                        busy={phase === `resubmit-${receipt.txHash}`}
                                        disabled={busy}
                                        onClick={() =>
                                            void run(`resubmit-${receipt.txHash}`, async () => {
                                                await resubmitMint(receipt, submitOptions);
                                            })
                                        }
                                    >
                                        Resubmit signed transaction
                                    </BusyButton>
                                )}
                                <BusyButton
                                    busy={phase === `export-${receipt.txHash}.json`}
                                    disabled={busy}
                                    onClick={() =>
                                        void exportJson(receipt, `${receipt.txHash}.json`)
                                    }
                                >
                                    Export receipt
                                </BusyButton>
                            </Stack>
                        </Stack>
                    </Paper>
                ))}
                {journal.entries.length > 20 && (
                    <Typography variant="caption">
                        Showing the latest 20 receipts. Export all receipts to save the complete
                        history.
                    </Typography>
                )}
            </Stack>
        </Container>
    );
}
