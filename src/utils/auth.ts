export { buildEnclaveAuthFields } from "./enclave-auth";

export enum EnclaveSessionAuthMode {
  Normal = "normal",
  EIP712 = "eip712",
}

export const resolveSessionAuthMode = (useEIP712: boolean): EnclaveSessionAuthMode =>
  useEIP712 ? EnclaveSessionAuthMode.EIP712 : EnclaveSessionAuthMode.Normal;

export const buildEnclaveSignMessage = (
  sessionId: string,
  authMode: EnclaveSessionAuthMode = EnclaveSessionAuthMode.EIP712,
): string => {
  const lines = ["Authorize Hinkal session", `Session ID: ${sessionId}`];

  if (authMode === EnclaveSessionAuthMode.Normal) {
    lines.push("This signature can also be used to submit transactions.");
  }

  return lines.join("\n");
};
