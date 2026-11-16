import { Alert, AlertTitle, Box, Typography } from "@mui/material";
import { friendlyError } from "./errors";
export default function ErrorNotice({
    error,
    context,
    onClose,
}: {
    error: unknown;
    context?: string;
    onClose?: () => void;
}) {
    const value = friendlyError(error, context);
    return (
        <Alert severity="error" onClose={onClose}>
            <AlertTitle>{value.title}</AlertTitle>
            <Typography variant="body2">{value.message}</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
                {value.action}
            </Typography>
            <Box component="details" sx={{ mt: 1 }}>
                <Box component="summary" sx={{ cursor: "pointer" }}>
                    Technical details
                </Box>
                <Typography
                    component="pre"
                    variant="caption"
                    sx={{ mt: 1, mb: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                    {value.details}
                </Typography>
            </Box>
        </Alert>
    );
}
