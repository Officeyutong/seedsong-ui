import { useState, type CSSProperties } from "react";
import { Box, useTheme } from "@mui/material";
import { ccc } from "@ckb-ccc/connector-react";
import { getChainClient } from "../chain/client";
import type { DecoderSession } from "../decoder/engine";
import MintView from "../mint/MintView";
import GalleryView from "../gallery/GalleryView";

/** One wallet connection shared by Mint and Gallery. */
export default function WalletViews(props: {
    tab: number;
    dna: string;
    onDnaChange: (dna: string) => void;
    decoder: DecoderSession | null;
    sourceBusy: boolean;
    mintBusy: boolean;
    onBusy: (busy: boolean) => void;
}) {
    const theme = useTheme();
    const [client] = useState(getChainClient);
    return (
        <ccc.Provider
            name="Seedsong"
            defaultClient={client}
            clientOptions={[{ name: "CKB Testnet · Light client", client }]}
            connectorProps={{
                style: {
                    zIndex: 1500,
                    color: theme.palette.text.primary,
                    "--background": theme.palette.background.paper,
                } as CSSProperties,
            }}
        >
            <Box
                role="tabpanel"
                id="panel-mint"
                aria-labelledby="tab-mint"
                hidden={props.tab !== 2}
            >
                <MintView
                    dna={props.dna}
                    onDnaChange={props.onDnaChange}
                    decoder={props.decoder}
                    sourceBusy={props.sourceBusy}
                    onBusy={props.onBusy}
                />
            </Box>
            <Box
                role="tabpanel"
                id="panel-gallery"
                aria-labelledby="tab-gallery"
                hidden={props.tab !== 3}
            >
                {props.tab === 3 && (
                    <GalleryView
                        decoder={props.decoder}
                        sourceBusy={props.sourceBusy}
                        mintBusy={props.mintBusy}
                    />
                )}
            </Box>
        </ccc.Provider>
    );
}
