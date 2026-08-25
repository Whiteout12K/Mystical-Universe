import { jsonResponse } from "../_utils.js";

const REGISTRATION_LIMIT = 3;
const REGISTRATION_WINDOW = 15 * 60;

const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const PASSWORD_REGEX = /^\d{4}$/;

async function checkRegistrationLimit(env, deviceId) {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - REGISTRATION_WINDOW;

    const row = await env.DB
        .prepare(
            `SELECT window_start, account_count
             FROM registration_limits
             WHERE ip = ?`
        )
        .bind(deviceId)
        .first();

    if (!row) {
        await env.DB
            .prepare(
                `INSERT INTO registration_limits
                 (ip, window_start, account_count)
                 VALUES (?, ?, 1)`
            )
            .bind(deviceId, now)
            .run();

        return true;
    }

    if (row.window_start <= windowStart) {
        await env.DB
            .prepare(
                `UPDATE registration_limits
                 SET window_start = ?, account_count = 1
                 WHERE ip = ?`
            )
            .bind(now, deviceId)
            .run();

        return true;
    }

    if (row.account_count >= REGISTRATION_LIMIT) {
        return false;
    }

    await env.DB
        .prepare(
            `UPDATE registration_limits
             SET account_count = account_count + 1
             WHERE ip = ?`
        )
        .bind(deviceId)
        .run();

    return true;
}

function getDeviceId(request) {
    const cookie = request.headers.get("Cookie") || "";

    const match = cookie.match(
        /(?:^|;\s*)registration_id=([^;]+)/
    );

    if (!match) {
        return null;
    }

    try {
        return decodeURIComponent(match[1]);
    } catch {
        return null;
    }
}

function createDeviceId() {
    return crypto.randomUUID();
}




function createInitialData() {
    return {
        silver_coin: 0, // Silver Coins, main currency
        ar_level: 1, // Adventure Rank Level
        ar_xp: 0, // Adventure Rank XP
        energy: 100, // Daily Energy

        // Account Stuff
        avatar: 1, // Current Avatar
        avatar_frame: 1, // Current Avatar Frame, 1 = none
        bg: 1, // Current Background, 1 = none

        settings: {
            keyboard_input: true,
            music_volume: 0.5,
            sfx_volume: 0.5,
            voice_volume: 0.5
        },

        season_pass_owned: 1, // Current Season Pass Bought
        season_pass_level: 1, // Current Season Pass Level
        season_pass_xp: 0, // Current Season Pass XP

        premium: { // Premium Currencies
            bronze_bits: 0, // Bronze Bits
            ruby_tablet: 0, // Ruby Tablet
            sapphire_tablet: 0, // Sapphire Tablet
            emerald_tablet: 0, // Emerald Tablet
            diamond_core: 0, // Diamond Core

            sr_star_lv_frag: 0,
            ssr_star_lv_frag: 0,
            ur_star_lv_frag: 0
        },

        mc_skill_tree_unlock: [], // Main character skill tree -
        // Each item contains a sub-list that pertains to one selection of abilities.
        // Within that sublist, there are nodes that start at 0, unlock at 1, and upgrade by
        // higher numbers, up to 10.

        c_owned: [
            1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0
        ], // Characters Owned
        // Each item is in order of character ID, where 0 is not owned, and 1 is owned.

        c_equipped_skills: [], // Characters' Equipped Skills
        // Each item, in order of character ID, contains a sublist of length 6 for their
        // 1 Basic Skill, 2 Special Skills, 1 Ultimate Skill, and 2 Technical Skills.

        c_skill1_owned: [], // Characters' Owned Basic Skills.
        // Each item, in order of character ID, contains a sublist of all the Basic Skills
        // they may own, where 0 is not owned, and 1 is owned.

        c_skill2_owned: [], // Characters' Owned Special Skills.
        c_skill3_owned: [], // Characters' Owned Ultimate Skills.
        c_skill4_owned: [], // Characters' Owned Technical Skills.

        c_costume_owned: [], // Characters' Owned Costumes.
        // Each item, in order of character ID, contains a sublist of all the Costumes unlocked
        // for that character, where 0 is not unlocked, and 1 is unlocked.

        c_costume_equipped: [], // Characters' Equipped Costumes.
        // Each item represents the current costume equipped by that ID character.
        // The costume # is the same as the order of costume in c_costume_owned.
        // 0 is the default costume, 1 is the first costume, 2+, etc...

        // Each inventory contains a sublist to hold item name, id, and data.
        // When quantity is false, the item is unique and cannot be stacked.
        // When quantity is a number, it can be stacked.

        inventory1: [ // Weapons and Equipment
            {
                id: 1,
                name: "Gladius Lucis",
                type: "Weapon",
                quantity: false,
                rarity: 5,
                star_level: 0,
                level: 1,
                xp_level: 0
            },
            {
                id: 1,
                name: "Fighter's Armor",
                type: "Accessory",
                quantity: false,
                rarity: 1,
                star_level: 0,
                level: 1,
                xp_level: 0
            }
        ],

        inventory2: [], // Artifacts
        inventory3: [], // Materials
        inventory4: [], // Consumables
        inventory5: [], // Builds / Schematics
        inventory6: [], // Gadgets
        inventory7: [], // Special Items

        c1: { // C1
            Id:1,
            name:"Avery",
            rarity: 5,
            level: 100,
            xp: 0,
            equip: {
                weapon: [
                    {
                    id: 1,
                    name: "Gladius Lucis",
                    type: "Weapon",
                    quantity: false,
                    rarity: 5,
                    star_level: 0,
                    level: 100,
                    xp_level: 0
                    },
                ],
                accessory: [
                    {
                    id: 1,
                    name: "Rune of the Spellcaster",
                    type: "Accessory",
                    quantity: false,
                    rarity: 5,
                    star_level: 0,
                    level: 100,
                    xp_level: 0
                    },
                ],
                artifact1: [
                    {
                    id: 3,
                    piece_num: 1,
                    type: "Artifact",
                    quantity: false,
                    rarity: 5,
                    level: 20,
                    xp_level: 0,

                    main: "health",
                    main_value: 3,
                    main_type: "%",

                    sub_1: "crit_rate",
                    sub_1_value: "5",
                    sub_1_type: "+",
                    sub_1_rolls: "0",

                    sub_2: "crit_dmg",
                    sub_2_value: "8",
                    sub_2_type: "+",
                    sub_2_rolls: "4",

                    sub_3: "gauge_gain",
                    sub_3_value: "4",
                    sub_3_type: "+",
                    sub_3_rolls: "1",

                    sub_4: "attack",
                    sub_4_value: "5",
                    sub_4_type: "%",
                    sub_4_rolls: "0"
                    },
                ],
                artifact2: [
                    {
                    id: 3,
                    piece_num: 2,
                    type: "Artifact",
                    quantity: false,
                    rarity: 5,
                    level: 20,
                    xp_level: 0,

                    main: "defense",
                    main_value: 3,
                    main_type: "%",

                    sub_1: "crit_rate",
                    sub_1_value: "5",
                    sub_1_type: "+",
                    sub_1_rolls: "2",

                    sub_2: "crit_dmg",
                    sub_2_value: "8",
                    sub_2_type: "+",
                    sub_2_rolls: "2",

                    sub_3: "gauge_gain",
                    sub_3_value: "4",
                    sub_3_type: "+",
                    sub_3_rolls: "1",

                    sub_4: "attack",
                    sub_4_value: "5",
                    sub_4_type: "%",
                    sub_4_rolls: "0"
                    },
                ],
                artifact3: [
                    {
                    id: 3,
                    piece_num: 3,
                    type: "Artifact",
                    quantity: false,
                    rarity: 5,
                    level: 20,
                    xp_level: 0,

                    main: "attack",
                    main_value: 2.5,
                    main_type: "%",

                    sub_1: "crit_rate",
                    sub_1_value: "5",
                    sub_1_type: "+",
                    sub_1_rolls: "2",

                    sub_2: "crit_dmg",
                    sub_2_value: "8",
                    sub_2_type: "+",
                    sub_2_rolls: "2",

                    sub_3: "gauge_gain",
                    sub_3_value: "4",
                    sub_3_type: "+",
                    sub_3_rolls: "1",

                    sub_4: "health",
                    sub_4_value: "6",
                    sub_4_type: "%",
                    sub_4_rolls: "0"
                    },
                ],
                artifact4: [
                    {
                    id: 3,
                    piece_num: 4,
                    type: "Artifact",
                    quantity: false,
                    rarity: 5,
                    level: 20,
                    xp_level: 0,

                    main: "crit_dmg",
                    main_value: 3.5,
                    main_type: "+",

                    sub_1: "crit_rate",
                    sub_1_value: "5",
                    sub_1_type: "+",
                    sub_1_rolls: "2",

                    sub_2: "health",
                    sub_2_value: "6",
                    sub_2_type: "%",
                    sub_2_rolls: "2",

                    sub_3: "gauge_gain",
                    sub_3_value: "4",
                    sub_3_type: "+",
                    sub_3_rolls: "1",

                    sub_4: "attack",
                    sub_4_value: "5",
                    sub_4_type: "%",
                    sub_4_rolls: "0"
                    },
                ]
            }
        }, 
        c2: { // C2
            Id:2,
            name:"Kaden Icelander",
            rarity: 5,
            level: 100,
            xp: 0,
            equip: {
                weapon: [
                    {
                    id: 2,
                    name: "Icelorian Blade",
                    type: "Weapon",
                    quantity: false,
                    rarity: 5,
                    star_level: 0,
                    level: 100,
                    xp_level: 0
                    },
                ],
                accessory: [
                    {
                    id: 2,
                    name: "Water Spirit Rune",
                    type: "Accessory",
                    quantity: false,
                    rarity: 5,
                    star_level: 0,
                    level: 100,
                    xp_level: 0
                    },
                ],
                artifact1: [
                    {
                    id: 4,
                    piece_num: 1,
                    type: "Artifact",
                    quantity: false,
                    rarity: 5,
                    level: 20,
                    xp_level: 0,

                    main: "mana",
                    main_value: 3,
                    main_type: "%",

                    sub_1: "crit_rate",
                    sub_1_value: "5",
                    sub_1_type: "+",
                    sub_1_rolls: "2",

                    sub_2: "crit_dmg",
                    sub_2_value: "8",
                    sub_2_type: "+",
                    sub_2_rolls: "2",

                    sub_3: "gauge_gain",
                    sub_3_value: "4",
                    sub_3_type: "+",
                    sub_3_rolls: "0",

                    sub_4: "attack",
                    sub_4_value: "5",
                    sub_4_type: "%",
                    sub_4_rolls: "1"
                    },
                ],
                artifact2: [
                    {
                    id: 4,
                    piece_num: 2,
                    type: "Artifact",
                    quantity: false,
                    rarity: 5,
                    level: 20,
                    xp_level: 0,

                    main: "piercing",
                    main_value: 1.5,
                    main_type: "+",

                    sub_1: "crit_rate",
                    sub_1_value: "5",
                    sub_1_type: "+",
                    sub_1_rolls: "2",

                    sub_2: "crit_dmg",
                    sub_2_value: "8",
                    sub_2_type: "+",
                    sub_2_rolls: "2",

                    sub_3: "gauge_gain",
                    sub_3_value: "4",
                    sub_3_type: "+",
                    sub_3_rolls: "1",

                    sub_4: "attack",
                    sub_4_value: "5",
                    sub_4_type: "%",
                    sub_4_rolls: "0"
                    },
                ],
                artifact3: [
                    {
                    id: 4,
                    piece_num: 3,
                    type: "Artifact",
                    quantity: false,
                    rarity: 5,
                    level: 20,
                    xp_level: 0,

                    main: "attack",
                    main_value: 2.5,
                    main_type: "%",

                    sub_1: "crit_rate",
                    sub_1_value: "5",
                    sub_1_type: "+",
                    sub_1_rolls: "2",

                    sub_2: "crit_dmg",
                    sub_2_value: "8",
                    sub_2_type: "+",
                    sub_2_rolls: "2",

                    sub_3: "gauge_gain",
                    sub_3_value: "4",
                    sub_3_type: "+",
                    sub_3_rolls: "1",

                    sub_4: "cooldown_red",
                    sub_4_value: "3",
                    sub_4_type: "+",
                    sub_4_rolls: "0"
                    },
                ],
                artifact4: [
                    {
                    id: 4,
                    piece_num: 4,
                    type: "Artifact",
                    quantity: false,
                    rarity: 5,
                    level: 20,
                    xp_level: 0,

                    main: "crit_dmg",
                    main_value: 3.5,
                    main_type: "+",

                    sub_1: "crit_rate",
                    sub_1_value: "5",
                    sub_1_type: "+",
                    sub_1_rolls: "3",

                    sub_2: "piercing",
                    sub_2_value: "3",
                    sub_2_type: "+",
                    sub_2_rolls: "1",

                    sub_3: "gauge_gain",
                    sub_3_value: "4",
                    sub_3_type: "+",
                    sub_3_rolls: "0",

                    sub_4: "attack",
                    sub_4_value: "5",
                    sub_4_type: "%",
                    sub_4_rolls: "1"
                    },
                ]
            }
        }, 
        c3: {}, // C3
        c4: { // C2
            Id:4,
            name:"Main Character",
            rarity: 5,
            level: 100,
            xp: 0,
            equip: {
                weapon: [
                    {
                    id: 2,
                    name: "Icelorian Blade",
                    type: "Weapon",
                    quantity: false,
                    rarity: 5,
                    star_level: 0,
                    level: 100,
                    xp_level: 0
                    },
                ],
                accessory: [
                    {
                    id: 2,
                    name: "Water Spirit Rune",
                    type: "Accessory",
                    quantity: false,
                    rarity: 5,
                    star_level: 0,
                    level: 100,
                    xp_level: 0
                    },
                ],
                artifact1: [
                    {
                    id: 4,
                    piece_num: 1,
                    type: "Artifact",
                    quantity: false,
                    rarity: 5,
                    level: 20,
                    xp_level: 0,

                    main: "mana",
                    main_value: 3,
                    main_type: "%",

                    sub_1: "crit_rate",
                    sub_1_value: "5",
                    sub_1_type: "+",
                    sub_1_rolls: "2",

                    sub_2: "crit_dmg",
                    sub_2_value: "8",
                    sub_2_type: "+",
                    sub_2_rolls: "2",

                    sub_3: "gauge_gain",
                    sub_3_value: "4",
                    sub_3_type: "+",
                    sub_3_rolls: "0",

                    sub_4: "attack",
                    sub_4_value: "5",
                    sub_4_type: "%",
                    sub_4_rolls: "1"
                    },
                ],
                artifact2: [
                    {
                    id: 4,
                    piece_num: 2,
                    type: "Artifact",
                    quantity: false,
                    rarity: 5,
                    level: 20,
                    xp_level: 0,

                    main: "piercing",
                    main_value: 1.5,
                    main_type: "+",

                    sub_1: "crit_rate",
                    sub_1_value: "5",
                    sub_1_type: "+",
                    sub_1_rolls: "2",

                    sub_2: "crit_dmg",
                    sub_2_value: "8",
                    sub_2_type: "+",
                    sub_2_rolls: "2",

                    sub_3: "gauge_gain",
                    sub_3_value: "4",
                    sub_3_type: "+",
                    sub_3_rolls: "1",

                    sub_4: "attack",
                    sub_4_value: "5",
                    sub_4_type: "%",
                    sub_4_rolls: "0"
                    },
                ],
                artifact3: [
                    {
                    id: 4,
                    piece_num: 3,
                    type: "Artifact",
                    quantity: false,
                    rarity: 5,
                    level: 20,
                    xp_level: 0,

                    main: "attack",
                    main_value: 2.5,
                    main_type: "%",

                    sub_1: "crit_rate",
                    sub_1_value: "5",
                    sub_1_type: "+",
                    sub_1_rolls: "2",

                    sub_2: "crit_dmg",
                    sub_2_value: "8",
                    sub_2_type: "+",
                    sub_2_rolls: "2",

                    sub_3: "gauge_gain",
                    sub_3_value: "4",
                    sub_3_type: "+",
                    sub_3_rolls: "1",

                    sub_4: "cooldown_red",
                    sub_4_value: "3",
                    sub_4_type: "+",
                    sub_4_rolls: "0"
                    },
                ],
                artifact4: [
                    {
                    id: 4,
                    piece_num: 4,
                    type: "Artifact",
                    quantity: false,
                    rarity: 5,
                    level: 20,
                    xp_level: 0,

                    main: "crit_dmg",
                    main_value: 3.5,
                    main_type: "+",

                    sub_1: "crit_rate",
                    sub_1_value: "5",
                    sub_1_type: "+",
                    sub_1_rolls: "3",

                    sub_2: "piercing",
                    sub_2_value: "3",
                    sub_2_type: "+",
                    sub_2_rolls: "1",

                    sub_3: "gauge_gain",
                    sub_3_value: "4",
                    sub_3_type: "+",
                    sub_3_rolls: "0",

                    sub_4: "attack",
                    sub_4_value: "5",
                    sub_4_type: "%",
                    sub_4_rolls: "1"
                    },
                ]
            }
        }, 
        c5: {}, // C5
        c6: {}, // C6
        c7: {}, // C7
        c8: {}, // C8
        c9: {}, // C9
        c10: {}, // C10
        c11: {}, // C11

        achievements: { // Achievements Unlocked
            "First Enemy Kill": 0,
            "First Boss Killed": 0,
            "First Domain Entered": 0
        },

        flags: {}
    };
}




async function createUser(env, username, password, deviceId) {
    username = String(username ?? "").trim();
    password = String(password ?? "").trim();

    // Username validation
    if (!username) {
        return jsonResponse({
            success: false,
            error: "Username is required."
        }, 400);
    }

    if (!USERNAME_REGEX.test(username)) {
        return jsonResponse({
            success: false,
            error: "Username may only contain letters, numbers, _ and -."
        }, 400);
    }

    if (username.length > 32) {
        return jsonResponse({
            success: false,
            error: "Username must be 32 characters or less."
        }, 400);
    }

    // Password validation
    if (!PASSWORD_REGEX.test(password)) {
        return jsonResponse({
            success: false,
            error: "Password must be exactly 4 digits."
        }, 400);
    }

    // Check whether username already exists
    const existing = await env.DB
        .prepare(
            "SELECT id FROM users WHERE username = ? LIMIT 1"
        )
        .bind(username)
        .first();

    if (existing) {
        return jsonResponse({
            success: false,
            error: "That username already exists."
        }, 409);
    }

    // Check registration limit
    const allowed = await checkRegistrationLimit(
        env,
        deviceId
    );

    if (!allowed) {
        return jsonResponse({
            success: false,
            error:
                "You have created a maximum of 3 accounts. Please try again in 15 minutes."
        }, 429);
    }

    // Create initial account data
    const initialData = createInitialData();
    const saveData = JSON.stringify(initialData);

    try {
        // Create user in database
        await env.DB
            .prepare(
                `INSERT INTO users
                 (username, password, save_data)
                 VALUES (?, ?, ?)`
            )
            .bind(
                username,
                password,
                saveData
            )
            .run();

    } catch (error) {
        console.error("Create user error:", error);

        // Handle username collision caused by simultaneous requests
        if (
            error?.message
                ?.toLowerCase()
                .includes("unique")
        ) {
            return jsonResponse({
                success: false,
                error: "That username already exists."
            }, 409);
        }

        return jsonResponse({
            success: false,
            error: "Could not create user."
        }, 500);
    }

    return jsonResponse({
        success: true,
        message: "User created successfully.",
        username,
        data: initialData
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        let body;

        // Read request body
        try {
            body = await request.json();
        } catch {
            return jsonResponse({
                success: false,
                error: "Invalid request."
            }, 400);
        }

        // Make sure request body is an object
        if (
            !body ||
            typeof body !== "object" ||
            Array.isArray(body)
        ) {
            return jsonResponse({
                success: false,
                error: "Invalid request."
            }, 400);
        }

        // Get existing device ID
        let deviceId = getDeviceId(request);
        let newDevice = false;

        // Create device ID if one does not exist
        if (!deviceId) {
            deviceId = createDeviceId();
            newDevice = true;
        }

        // Create user
        const response = await createUser(
            env,
            body.username,
            body.password,
            deviceId
        );

        // Set registration cookie for new devices
        if (newDevice) {
            response.headers.append(
                "Set-Cookie",
                `registration_id=${encodeURIComponent(deviceId)}; ` +
                "Max-Age=31536000; " +
                "Path=/; " +
                "SameSite=Lax; " +
                "HttpOnly; " +
                "Secure"
            );
        }

        return response;

    } catch (error) {
        console.error(
            "Create-user request error:",
            error
        );

        return jsonResponse({
            success: false,
            error: "Server error."
        }, 500);
    }
}