import type { Env } from "@/env";
import type { Command } from "@/commands";
import { randomColor, USER_AGENT } from "@/util";
import {
  type APIApplicationCommandInteraction,
  type APIApplicationCommandInteractionDataUserOption as APICommandInteractionUserOption,
  type APIChatInputApplicationCommandInteraction as APIChatInputInteraction,
  type APIComponentInContainer,
  type APIInteractionResponse,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  ComponentType,
  InteractionContextType,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/payloads/v10";

export type NekosCategory =
  | "baka"
  | "bite"
  | "blush"
  | "bored"
  | "cry"
  | "cuddle"
  | "dance"
  | "facepalm"
  | "feed"
  | "handhold"
  | "handshake"
  | "happy"
  | "highfive"
  | "hug"
  | "husbando"
  | "kick"
  | "kiss"
  | "kitsune"
  | "laugh"
  | "lurk"
  | "neko"
  | "nod"
  | "nom"
  | "nope"
  | "pat"
  | "peck"
  | "poke"
  | "pout"
  | "punch"
  | "shoot"
  | "shrug"
  | "slap"
  | "sleep"
  | "smile"
  | "smug"
  | "stare"
  | "think"
  | "thumbsup"
  | "tickle"
  | "waifu"
  | "wave"
  | "wink"
  | "yawn"
  | "yeet";

interface NekosResult {
  artist_href?: string;
  artist_name?: string;
  source_url?: string;
  anime_name?: string;
  url: string;
}

interface NekosResponse {
  results: NekosResult[];
}

const fetchNekos = async (baseUrl: string, category: NekosCategory, amount: number = 1): Promise<NekosResponse> => {
  const url = `${baseUrl}/${category}` + (amount > 1 ? `?amount=${amount}` : "");

  return fetch(url, { headers: { "User-Agent": USER_AGENT } })
    .then(async (r) => {
      const text = await r.text();
      try {
        return JSON.parse(text) as NekosResponse;
      } catch (e) {
        console.error(`Failed to parse JSON; status: ${r.status}, data: ${text}`);
        throw e;
      }
    });
};

export interface Action {
  name: string;
  description: string;
  category?: NekosCategory;
  messages: ActionMessages;
}

export interface ActionMessages {
  normal: string | string[];
  lonely: string | string[];
  self: string | string[];
}

// based on Mantaro's interactions <3

export const createAction = (action: Action): Command => {
  return {
    name: action.name,
    description: action.description,
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "The receiving user.",
        required: true,
      },
    ],
    integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
    contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
    async handle(
      interaction: APIApplicationCommandInteraction,
      env: Env,
      _ctx: ExecutionContext
    ): Promise<APIInteractionResponse> {
      let invoker = interaction.user;
      if (!invoker) {
        invoker = interaction.member!.user;
      }

      const user = (interaction as APIChatInputInteraction).data.options![0] as APICommandInteractionUserOption;
      try {
        const nekos = await fetchNekos(env.NEKOS_API_URL, action.category || (action.name as NekosCategory));

        let messages = action.messages.normal;
        if (user.value === invoker.id) {
          messages = action.messages.lonely;
        } else if (user.value === interaction.application_id) {
          messages = action.messages.self;
        }

        let message = typeof messages === "string" ? messages : messages[Math.floor(Math.random() * messages.length)];
        message = message.replace("%invoker%", `<@${invoker.id}>`).replace("%user%", `<@${user.value}>`);

        const result = nekos.results[0];
        let components: APIComponentInContainer[] = [
          {
            type: ComponentType.TextDisplay,
            content: `:speech_balloon: ${message}`,
          },
          {
            type: ComponentType.MediaGallery,
            items: [
              {
                media: {
                  url: result.url,
                },
              },
            ],
          },
        ];

        if (result.anime_name) {
          components.push({
            type: ComponentType.TextDisplay,
            content: `-# ${result.anime_name} • [Search on AniList](<https://anilist.co/search/anime?search=${encodeURIComponent(result.anime_name)}>)`,
          });
        }

        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            components: [
              {
                type: ComponentType.Container,
                accent_color: randomColor(),
                components: components,
              },
            ],
            flags: MessageFlags.IsComponentsV2,
          },
        };
      } catch (e) {
        console.error(e);

        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: ":x: S-Sorry! I dropped the image. (something went wrong with my request to the API)",
            flags: MessageFlags.Ephemeral,
          },
        };
      }
    },
  };
};
