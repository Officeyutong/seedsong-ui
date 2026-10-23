import { Button, CircularProgress } from "@mui/material";
import type { ButtonProps } from "@mui/material";
interface Props extends ButtonProps {
    busy?: boolean;
    busyLabel?: string;
}
export default function BusyButton({
    busy = false,
    busyLabel,
    children,
    disabled,
    startIcon,
    ...props
}: Props) {
    return (
        <Button
            {...props}
            aria-busy={busy}
            disabled={disabled || busy}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : startIcon}
        >
            {busy && busyLabel ? busyLabel : children}
        </Button>
    );
}
