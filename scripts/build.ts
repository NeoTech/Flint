import { SiteBuilder, type BuildConfig } from '../src/core/builder.js';
import { mkdirSync, existsSync, copyFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

// Default build configuration
const config: BuildConfig = {
  contentDir: join(process.cwd(), 'content'),
  outputDir: join(process.cwd(), 'dist'),
  templatesDir: join(process.cwd(), 'templates'),
  defaultTitle: 'My Static Site',
  siteUrl: process.env.SITE_URL || '',
};

/**
 * Copy static assets to output directory
 */
function copyStaticAssets(): void {
  const staticDir = join(process.cwd(), 'static');
  const outputDir = config.outputDir;

  if (!existsSync(staticDir)) {
    return;
  }

  function copyRecursive(src: string, dest: string): void {
    mkdirSync(dest, { recursive: true });
    
    const entries = readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      
      if (entry.isDirectory()) {
        copyRecursive(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
  }

  copyRecursive(staticDir, outputDir);
  // Also copy to dist/static/ so paths like /static/products/blue-mug.html work
  copyRecursive(staticDir, join(outputDir, 'static'));
  console.log('✓ Static assets copied');
}

/**
 * Main build function
 */
async function build(): Promise<void> {
  console.log('🚀 Starting build...\n');

  const startTime = Date.now();

  try {
    // Ensure output directory exists
    mkdirSync(config.outputDir, { recursive: true });

    // Create builder and run build
    const builder = new SiteBuilder(config);
    await builder.build();

    console.log('✓ Pages generated');

    // Copy static assets
    copyStaticAssets();

    const duration = Date.now() - startTime;
    console.log(`\n✅ Build completed in ${duration}ms`);
    console.log(`📁 Output: ${config.outputDir}`);
  } catch (error) {
    console.error('\n❌ Build failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run build if this file is executed directly
build();

export { build, config };
