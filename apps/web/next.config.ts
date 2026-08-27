import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Gera o bundle auto-contido usado pela imagem Docker.
  output: 'standalone',
  // Em monorepo, o tracing precisa enxergar a raiz para incluir o node_modules
  // hasteado pelos workspaces.
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
};

export default nextConfig;
