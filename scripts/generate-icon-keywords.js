#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Script to generate localized icon keywords from FontAwesome metadata
 * 
 * Input: FontAwesome icon-families.json
 * Output: Localized keyword mapping in format:
 * {
 *   "iconName": {
 *     "en": ["keyword1", "keyword2", ...]
 *   }
 * }
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, '..', 'node_modules', '@fortawesome', 'fontawesome-free', 'metadata', 'icon-families.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'metadata', 'icon-keywords.json');

function generateIconKeywords() {
  console.log('🚀 Generating localized icon keywords...');
  
  try {
    // Read the FontAwesome metadata file
    if (!fs.existsSync(INPUT_FILE)) {
      throw new Error(`Input file not found: ${INPUT_FILE}`);
    }
    
    console.log(`📖 Reading FontAwesome metadata from: ${INPUT_FILE}`);
    const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
    const iconFamilies = JSON.parse(rawData);
    
    // Transform the data
    const localizedKeywords = {};
    let processedCount = 0;
    let skippedCount = 0;
    
    console.log('🔄 Processing icons...');
    
    for (const [iconName, iconData] of Object.entries(iconFamilies)) {
      if (iconData && iconData.search && iconData.search.terms && Array.isArray(iconData.search.terms)) {
        // Create the localized structure
        localizedKeywords[iconName] = {
          en: iconData.search.terms
        };
        processedCount++;
        
        // Log a few examples
        if (processedCount <= 5) {
          console.log(`   ✅ ${iconName}: ${iconData.search.terms.slice(0, 3).join(', ')}${iconData.search.terms.length > 3 ? '...' : ''}`);
        }
      } else {
        skippedCount++;
        
        // Log a few examples of skipped icons
        if (skippedCount <= 5) {
          console.log(`   ⚠️  ${iconName}: No search terms found`);
        }
      }
    }
    
    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created directory: ${outputDir}`);
    }
    
    // Write the output file
    console.log(`💾 Writing localized keywords to: ${OUTPUT_FILE}`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(localizedKeywords, null, 2), 'utf8');
    
    // Generate statistics
    const stats = {
      totalIcons: Object.keys(iconFamilies).length,
      processedIcons: processedCount,
      skippedIcons: skippedCount,
      outputFileSize: fs.statSync(OUTPUT_FILE).size,
      sampleKeywords: Object.keys(localizedKeywords).slice(0, 10).reduce((acc, iconName) => {
        acc[iconName] = localizedKeywords[iconName];
        return acc;
      }, {})
    };
    
    console.log('\n📊 Generation Summary:');
    console.log(`   Total icons in metadata: ${stats.totalIcons}`);
    console.log(`   Icons with keywords: ${stats.processedIcons}`);
    console.log(`   Icons skipped: ${stats.skippedIcons}`);
    console.log(`   Output file size: ${(stats.outputFileSize / 1024).toFixed(2)} KB`);
    console.log(`   Coverage: ${((stats.processedIcons / stats.totalIcons) * 100).toFixed(1)}%`);
    
    // Show sample of generated data
    console.log('\n🔍 Sample generated keywords:');
    Object.entries(stats.sampleKeywords).slice(0, 3).forEach(([iconName, data]) => {
      console.log(`   ${iconName}: [${data.en.join(', ')}]`);
    });
    
    console.log('\n✅ Icon keywords generated successfully!');
    console.log(`📄 Output file: ${OUTPUT_FILE}`);
    console.log('\n💡 Usage in your app:');
    console.log('   const keywords = await fetch("/metadata/icon-keywords.json");');
    console.log('   const iconKeywords = await keywords.json();');
    console.log('   const broomKeywords = iconKeywords.broom.en;');
    
  } catch (error) {
    console.error('❌ Error generating icon keywords:', error.message);
    process.exit(1);
  }
}

// Run the script
generateIconKeywords();

export { generateIconKeywords }; 