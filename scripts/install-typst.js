
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const PLATFORM = os.platform();
const ARCH = os.arch();

// Map Node.js platform/arch to Typst release names
const platformMap = {
    'darwin': 'apple-darwin',
    'linux': 'unknown-linux-musl', // musl works on most Linux including Vercel
    'win32': 'pc-windows-msvc'
};

const archMap = {
    'x64': 'x86_64',
    'arm64': 'aarch64'
};

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, { followRedirect: true }, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Follow redirect
                https.get(response.headers.location, (res) => {
                    res.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                });
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

async function install() {
    const platform = platformMap[PLATFORM];
    const arch = archMap[ARCH] || 'x86_64';

    if (!platform) {
        throw new Error(`Unsupported platform: ${PLATFORM}`);
    }

    const version = '0.11.0';
    const target = `${arch}-${platform}`;
    const filename = `typst-${target}.tar.gz`;
    const url = `https://github.com/typst/typst/releases/download/v${version}/${filename}`;

    const binDir = path.join(__dirname, '..', 'bin');
    const tarball = path.join(binDir, filename);
    const typstBinary = path.join(binDir, 'typst');

    console.log(`Installing Typst for ${target}...`);
    console.log(`URL: ${url}`);

    // Create bin directory
    if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
    }

    // Clean up old binary if exists
    if (fs.existsSync(typstBinary)) {
        try {
            fs.unlinkSync(typstBinary);
        } catch (e) {
            // Ignore if busy or whatever
        }
    }

    try {
        // Download
        await downloadFile(url, tarball);

        // Extract
        console.log('Extracting...');
        execSync(`tar -xzf ${filename}`, { cwd: binDir });

        // Find extracted binary (might be in subdirectory)
        const extractedDir = path.join(binDir, `typst-${target}`);
        if (fs.existsSync(extractedDir)) {
            const files = fs.readdirSync(extractedDir);
            const binaryFile = files.find(f => f === 'typst' || f === 'typst.exe');
            if (binaryFile) {
                fs.renameSync(path.join(extractedDir, binaryFile), typstBinary);
                // Cleanup extracted dir
                fs.rmSync(extractedDir, { recursive: true, force: true });
            }
        }

        // Make executable (Linux/Mac)
        if (PLATFORM !== 'win32') {
            fs.chmodSync(typstBinary, 0o755);
        }

        // Cleanup tarball
        if (fs.existsSync(tarball)) {
            fs.unlinkSync(tarball);
        }

        // Verify
        const versionOutput = execSync(`${typstBinary} --version`).toString();
        console.log(`✅ Typst installed successfully: ${versionOutput}`);

    } catch (error) {
        console.error('❌ Failed to install Typst:', error);
        process.exit(1);
    }
}

install();
