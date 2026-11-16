import { Buffer } from "buffer";
import process from "process";
const globals = globalThis as unknown as { Buffer?: typeof Buffer; process?: typeof process };
globals.Buffer ??= Buffer;
globals.process ??= process;
