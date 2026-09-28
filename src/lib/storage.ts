import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";

export const statementFiles = new Files({
  adapter: neon({ bucket: "estatements" }),
});
