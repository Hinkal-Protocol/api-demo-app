export { generateNonce, buildEnclaveAuthFields } from "./enclave-auth";

export enum EnclaveSessionAccess {
  Read = "read",
  Write = "write",
}

export const buildEnclaveSignMessage = (
  sessionId: string,
  access: EnclaveSessionAccess = EnclaveSessionAccess.Read,
): string => {
  const lines = ["Authorize Hinkal session", `Session ID: ${sessionId}`];

  if (access === EnclaveSessionAccess.Write) {
    lines.push("This signature can also be used to submit transactions.");
  }

  return lines.join("\n");
};
