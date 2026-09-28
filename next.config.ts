import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "files-sdk", "@aws-sdk/client-s3"],
};

export default nextConfig;
