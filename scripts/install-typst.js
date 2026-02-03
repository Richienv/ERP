const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');
const { pipeline } = require('stream/promises');

const PLATFORM = os.platform();
const ARCH = os.arch();

const STRICT = process.env.TYPST_STRICT === '1';

const platformMap = {
    'darwin': 'apple-darwin',
    'linux': 'unknown-linux-musl',
    'win32': 'pc-windows-msvc'
};

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading from: ${url}`);

        const fileStream = fs.createWriteStream(dest);

        https.get(url, {
            headers: {
                'User-Agent': 'Node.js',
                'Accept': 'application/octet-stream'
            }
        }, async (response) => {
            // Handle redirects manually
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                console.log(`Following redirect to: ${response.headers.location}`);

                // Close the current file stream
                fileStream.close();
                // Delete empty file if it was created
                if (fs.existsSync(dest)) {
                    fs.unlinkSync(dest);
                }

                // Follow redirect recursively
                try {
                    await downloadFile(response.headers.location, dest);
                    resolve();
                } catch (err) {
                    reject(err);
                }
                return;
            }

            if (response.statusCode !== 200) {
                fileStream.close();
                if (fs.existsSync(dest)) fs.unlinkSync(dest);
                reject(new Error(`Download failed with status ${response.statusCode}`));
                return;
            }

            await pipeline(response, fileStream);
            // Verify size
            const stats = fs.statSync(dest); // Should exist now
            console.log(`Downloaded successfully to ${dest} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            resolve();

        }).on('error', (err) => {
            fileStream.close();
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            reject(err);
        });
    });
}

async function install() {
    const platform = platformMap[PLATFORM];
    // Map standard NodeJS arch to Typst's expected arch string
    // os.arch() returns 'x64', 'arm64', etc.
    const arch = ARCH === 'arm64' ? 'aarch64' : 'x86_64';

    if (!platform) {
        console.warn(`⚠️  Unsupported platform: ${PLATFORM}, skipping Typst installation`);
        process.exit(0);
    }

    const version = '0.11.0';
    const target = `${arch}-${platform}`;
    const filename = `typst-${target}.tar.gz`;

    // GitHub releases URL
    const url = `https://github.com/typst/typst/releases/download/v${version}/${filename}`;

    const binDir = path.join(__dirname, '..', 'bin');
    const tarball = path.join(binDir, filename);
    const typstBinary = path.join(binDir, 'typst');

    console.log(`Installing Typst v${version} for ${target}...`);

    // If Typst already exists and is runnable, skip installation
    try {
        if (fs.existsSync(typstBinary)) {
            const versionOutput = execSync(`${typstBinary} --version`).toString().trim();
            if (versionOutput) {
                console.log(`✅ Typst already installed: ${versionOutput}`);
                process.exit(0);
            }
        }
    } catch (e) {
        // Ignore and attempt reinstall
    }

    // Create bin directory
    if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
    }

    try {
        // Clean up old tarball if exists
        if (fs.existsSync(tarball)) {
            fs.unlinkSync(tarball);
        }

        // Download with redirect support
        await downloadFile(url, tarball);

        // Verify it's actually a gzip file (check magic bytes)
        const fd = fs.openSync(tarball, 'r');
        const buffer = Buffer.alloc(2);
        fs.readSync(fd, buffer, 0, 2, 0);
        fs.closeSync(fd);

        // Gzip magic bytes: 0x1f 0x8b
        if (buffer[0] !== 0x1f || buffer[1] !== 0x8b) {
            const content = fs.readFileSync(tarball, 'utf8').slice(0, 200);
            throw new Error(`Downloaded file is not a valid gzip archive. Content starts with: ${content}`);
        }

        // Extract
        console.log('Extracting...');
        execSync(`tar -xzf ${filename}`, {
            cwd: binDir,
            stdio: 'inherit'
        });

        // Find extracted binary
        // The tarball extracts to a folder named `typst-{target}`
        const extractedDir = path.join(binDir, `typst-${target}`);
        if (fs.existsSync(extractedDir)) {
            const binaryName = PLATFORM === 'win32' ? 'typst.exe' : 'typst';
            const extractedBinary = path.join(extractedDir, binaryName);

            if (fs.existsSync(extractedBinary)) {
                // If destination exists, remove it first
                if (fs.existsSync(typstBinary)) {
                    fs.unlinkSync(typstBinary);
                }
                fs.renameSync(extractedBinary, typstBinary);
            }
            // Cleanup directory
            fs.rmSync(extractedDir, { recursive: true, force: true });
        }

        // Cleanup tarball
        if (fs.existsSync(tarball)) {
            fs.unlinkSync(tarball);
        }

        // Make executable
        if (PLATFORM !== 'win32') {
            fs.chmodSync(typstBinary, 0o755);
        }

        // Verify installation
        const versionOutput = execSync(`${typstBinary} --version`).toString().trim();
        console.log(`✅ Typst installed successfully: ${versionOutput}`);

    } catch (error) {
        console.error('❌ Failed to install Typst:', error.message);

        // Cleanup on failure
        if (fs.existsSync(tarball)) {
            try { fs.unlinkSync(tarball); } catch (e) { }
        }

        if (STRICT) {
            process.exit(1);
        }

        console.warn('⚠️  Continuing without Typst (set TYPST_STRICT=1 to fail on this error)');
        process.exit(0);
    }
}

install();
