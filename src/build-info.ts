export const BUILD_INFO = {
  version: "dev",
  commit: "",
  builtAt: "",
  target: "",
};

export function buildMetadataString(info = BUILD_INFO): string {
  const parts = [
    info.commit ? `commit=${info.commit}` : "",
    info.builtAt ? `builtAt=${info.builtAt}` : "",
    info.target ? `target=${info.target}` : "",
  ].filter((part) => part.length > 0);

  return parts.join(",");
}
