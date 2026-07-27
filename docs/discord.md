# Discord integration

Lore can pull messages out of Discord channels and link them to characters, so
in-character chat becomes part of the campaign record. Multiple servers and
channels are supported, each with its own bot token and sync settings.

The feature is gated by the ruleset's `discord` flag — a ruleset that turns it
off never registers the screens (see `src/ruleset/features.ts`).

## Setting up a bot

1. **Create the application.** [Discord Developer Portal](https://discord.com/developers/applications)
   → **New Application** → **Bot** → **Add Bot**. Copy the bot token.
2. **Enable MESSAGE CONTENT INTENT.** Bot tab → **Privileged Gateway Intents** →
   toggle **MESSAGE CONTENT INTENT** on → **Save Changes**. Without it Discord
   returns every message with an empty `content`, which is the single most
   common setup failure — see [Empty message content](#empty-message-content).
3. **Permissions.** The bot needs only _Read Messages/View Channels_ and _Read
   Message History_. It never posts.
4. **Invite it.** OAuth2 → scope `bot` → the two permissions above → open the
   generated URL and authorize. Repeat per server.
5. **Collect ids.** Discord → User Settings → Advanced → **Developer Mode**,
   then right-click to copy: channel id (required), server/guild id (optional),
   user ids (for character mapping).

## Using it in the app

### Server/channel management

**Server/Channel Management** from the Discord menu lists every configuration.
The global Discord toggle must be on. **+ Add Server/Channel** takes:

| Field              | Meaning                                           |
| ------------------ | ------------------------------------------------- |
| Configuration name | Free text, e.g. "Main server — IC chat"           |
| Bot token          | May be shared across configs or unique per server |
| Guild/server id    | Optional                                          |
| Channel id         | Required — the channel to read                    |
| Enabled            | Whether this config participates in syncs         |

Each row can be tested, synced on its own, edited, disabled, or deleted
(deleting a config leaves its already-stored messages alone).

### Syncing

- **One channel** — the **Sync** button on that server's card.
- **All channels** — the Discord configuration screen syncs every enabled
  config in one pass.
- **Automatically** — "Auto-sync when online" syncs enabled configs
  periodically when the device has a connection.

### Linking messages to characters

Two screens, for two different jobs:

- **Character Name Mapping** — bulk work. Groups messages by the character name
  extracted from a `>>[Name]` prefix and maps each name once.
- **Discord Messages** — individual review. Every message, extracted name or
  not, filterable by server/channel and by tagged / untagged / ignored. Tapping
  a message opens a modal showing the Discord username and id, the extracted
  name, the message text, any images, and a character picker.

Saving a mapping links the message immediately and, when the message carried an
extracted name, stores that name as an **alias** — later messages from the same
user with the same name link themselves.

**Message Context** shows a message inside its conversation, filtered to the
same server/channel and with the target message highlighted. Reachable from the
messages list and from a character's detail screen.

Users with no mapping still have their messages stored; they simply are not
attached to a character.

## Data

Everything is local. `src/utils/discordStorage.ts` owns four AsyncStorage keys:

| Key                                     | Contents                                 |
| --------------------------------------- | ---------------------------------------- |
| `gameCharacterManager_discord_config`   | global settings plus every server config |
| `gameCharacterManager_discord_mappings` | Discord user → character                 |
| `gameCharacterManager_discord_messages` | all messages, from all configs           |
| `gameCharacterManager_discord_aliases`  | learned character-name aliases           |

### Shapes

**`DiscordConfig`** — `enabled`, `autoSync`, `serverConfigs[]`. The legacy
single-server fields (`botToken`, `guildId`, `channelId`, `lastSync`) are still
read so old data migrates into a config named "Default Server", with existing
messages retroactively tagged to it.

**`DiscordServerConfig`** — `id`, `name`, `botToken`, `guildId?`, `channelId`,
`enabled`, `lastSync`, `createdAt`, `updatedAt`.

**`DiscordMessage`** — `id`, `channelId`, `guildId?`, `serverConfigId`,
`authorId`, `authorUsername`, `content`, `timestamp`, `characterId?`,
`extractedCharacterName?`, `imageUris` (local paths of downloaded images —
there is no `images` field), `attachments`, `createdAt`, `ignored`.

**`DiscordUserMapping`** — `discordUserId`, `discordUsername`, `characterId`,
timestamps. Global, not per-server.

**`DiscordCharacterAlias`** — `alias`, `characterId`, `discordUserId`,
`confidence` (0–1), `usageCount`, timestamps.

### Export and import

Exports carry the server configs (**including bot tokens** — keep export files
private), user mappings, every message, aliases, and the downloaded images.
Imports merge: configs by id, messages de-duplicated, mappings and aliases
merged. Both the single-server and multi-server export shapes are readable.

## Code

| Concern              | File                                      |
| -------------------- | ----------------------------------------- |
| REST calls, sync     | `src/utils/discordApi.ts`                 |
| Persistence          | `src/utils/discordStorage.ts`             |
| Character extraction | `src/utils/discordCharacterExtraction.ts` |
| Screens              | `src/screens/discord/`                    |

The API layer talks to Discord REST v10, fetches in pages of 100 (up to 1000
per channel per sync), respects rate limits, downloads images to local storage,
and syncs each server config independently.

## Troubleshooting

### Empty message content

Every message arrives with `content: ""` but attachments still work → **MESSAGE
CONTENT INTENT is off**. Enable it (setup step 2), wait a few minutes for
Discord to propagate, and re-sync. If the toggle is greyed out, the bot is in
100+ servers and needs Discord verification before it can hold that intent.

Without the intent a bot can still see message metadata, attachments and
embeds — just not the text.

### "Connection failed"

Check, in order: the token belongs to _this_ config; the bot is actually in the
server; it can read that channel; the channel id is right; MESSAGE CONTENT
INTENT is on.

### Messages not syncing

The global Discord toggle and the individual config must both be enabled, the
device must be online, and the bot must still have channel access. The config's
last-sync timestamp tells you whether a sync ran at all.

### Mappings not taking effect

User mappings apply to messages synced _after_ the mapping exists, so re-sync
after adding one. Verify the user id (Developer Mode) and that the user has
posted in a monitored channel.

### Character-name extraction not firing

The prefix must be `>>[Name]` at the start of the message. Whitespace around the
brackets is tolerated.

### Messages in the wrong channel

Each message carries the `serverConfigId` that fetched it. If they look mixed,
confirm each config's token and channel id, then re-sync the affected configs.

## Limits

- Only channels the bot can see; deleted messages are gone.
- 1000 messages per channel per sync (10 pages of 100). A long history takes
  several syncs to backfill.
- Discord image links expire — the app downloads them, but sync promptly.

## Further reading

- [Discord bot docs](https://discord.com/developers/docs)
- [Gateway intents](https://discord.com/developers/docs/topics/gateway#gateway-intents)
- [Message content intent FAQ](https://support-dev.discord.com/hc/en-us/articles/4404772028055)
