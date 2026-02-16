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
                fileStream.close();
                if (fs.existsSync(dest)) fs.unlinkSync(dest);

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
            const stats = fs.statSync(dest);
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
    const arch = ARCH === 'arm64' ? 'aarch64' : 'x86_64';

    if (!platform) {
        console.warn(`⚠️  Unsupported platform: ${PLATFORM}, skipping Typst installation`);
        process.exit(0);
    }

    const version = '0.12.0';
    const target = `${arch}-${platform}`;

    // v0.12+ uses .tar.xz, but v0.12.0 still ships .tar.gz for compatibility
    // Try .tar.xz first, fall back to .tar.gz
    const binDir = path.join(__dirname, '..', 'bin');
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

    // Also check if typst is available on PATH (e.g. via Homebrew)
    try {
        const versionOutput = execSync('typst --version').toString().trim();
        if (versionOutput) {
            console.log(`✅ Typst found on PATH: ${versionOutput}, skipping download`);
            process.exit(0);
        }
    } catch (e) {
        // Not on PATH, proceed with download
    }

    if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
    }

    // Try multiple archive formats — newer Typst releases use .tar.xz
    const formats = [
        { ext: 'tar.xz', extract: 'tar -xJf' },
        { ext: 'tar.gz', extract: 'tar -xzf' },
    ];

    let installed = false;

    for (const fmt of formats) {
        const filename = `typst-${target}.${fmt.ext}`;
        const url = `https://github.com/typst/typst/releases/download/v${version}/${filename}`;
        const tarball = path.join(binDir, filename);

        try {
            if (fs.existsSync(tarball)) fs.unlinkSync(tarball);

            await downloadFile(url, tarball);

            // Extract
            console.log(`Extracting (${fmt.ext})...`);
            execSync(`${fmt.extract} ${filename}`, {
                cwd: binDir,
                stdio: 'inherit'
            });

            // Find extracted binary — could be in typst-{target}/ subdir
            const extractedDir = path.join(binDir, `typst-${target}`);
            const binaryName = PLATFORM === 'win32' ? 'typst.exe' : 'typst';

            if (fs.existsSync(extractedDir)) {
                const extractedBinary = path.join(extractedDir, binaryName);
                if (fs.existsSync(extractedBinary)) {
                    if (fs.existsSync(typstBinary)) fs.unlinkSync(typstBinary);
                    fs.renameSync(extractedBinary, typstBinary);
                }
                fs.rmSync(extractedDir, { recursive: true, force: true });
            }

            // Cleanup tarball
            if (fs.existsSync(tarball)) fs.unlinkSync(tarball);

            // Make executable
            if (PLATFORM !== 'win32') {
                fs.chmodSync(typstBinary, 0o755);
            }

            // Verify
            const versionOutput = execSync(`${typstBinary} --version`).toString().trim();
            console.log(`✅ Typst installed successfully: ${versionOutput}`);
            installed = true;
            break;

        } catch (error) {
            console.warn(`⚠️  Failed with ${fmt.ext}: ${error.message}`);
            if (fs.existsSync(tarball)) {
                try { fs.unlinkSync(tarball); } catch (e) { }
            }
        }
    }

    if (!installed) {
        console.error('❌ Failed to install Typst from any source');

        if (STRICT) {
            process.exit(1);
        }

        console.warn('⚠️  Continuing without Typst (set TYPST_STRICT=1 to fail on this error)');
        process.exit(0);
    }
}

install();
