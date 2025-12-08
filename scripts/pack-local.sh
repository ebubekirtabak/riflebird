#!/bin/bash

# Script to pack and test Riflebird packages locally

echo "🎯 Packing Riflebird packages..."

# Pack core package
cd packages/core
pnpm pack
CORE_TGZ=$(ls riflebird-core-*.tgz 2>/dev/null || ls *.tgz)
echo "✓ Core packed: $CORE_TGZ"
cd ../..

# Pack CLI package
cd packages/cli
pnpm pack
CLI_TGZ=$(ls -t riflebird-*.tgz 2>/dev/null | head -n 1 || ls -t *.tgz | head -n 1)
echo "✓ CLI packed: $CLI_TGZ"
cd ../..

echo ""
echo "📦 Packages ready for testing!"
echo ""
echo "To install in your test project:"
echo "  cd your-test-project"
echo "  pnpm add ../riflebird/packages/core/$CORE_TGZ"
echo "  pnpm add ../riflebird/packages/cli/$CLI_TGZ"
echo ""
echo "Or globally:"
echo "  pnpm add -g ../riflebird/packages/cli/$CLI_TGZ"
