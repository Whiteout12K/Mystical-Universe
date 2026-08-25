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