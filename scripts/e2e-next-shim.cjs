/**
 * Preload for live E2E: mock Next request APIs so server actions can run in Node.
 * Cookie jar is global.__E2E_COOKIES — populate it after Supabase sign-in.
 */
if (!global.__E2E_COOKIES) global.__E2E_COOKIES = {}

const Module = require("module")
const origLoad = Module._load

function cookieStore() {
    const jar = global.__E2E_COOKIES
    return {
        get(name) {
            const value = jar[name]
            return value == null ? undefined : { name, value }
        },
        getAll() {
            return Object.entries(jar).map(([name, value]) => ({ name, value }))
        },
        set(arg, value) {
            if (typeof arg === "object" && arg && arg.name) {
                if (arg.value) jar[arg.name] = arg.value
                else delete jar[arg.name]
            } else if (typeof arg === "string") {
                if (value) jar[arg] = value
                else delete jar[arg]
            }
        },
        delete(name) {
            delete jar[name]
        },
        has(name) {
            return Object.prototype.hasOwnProperty.call(jar, name)
        },
    }
}

Module._load = function (request, parent, isMain) {
    if (request === "server-only") return {}
    if (request === "next/headers") {
        return {
            cookies: async () => cookieStore(),
            headers: async () => ({ get: () => null, has: () => false }),
        }
    }
    if (request === "next/cache") {
        return {
            revalidatePath() {},
            revalidateTag() {},
            unstable_cache: (fn) => fn,
            unstable_noStore() {},
        }
    }
    return origLoad.apply(this, arguments)
}
