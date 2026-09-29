import { App, Notice, PluginSettingTab, Setting, TFolder } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import { PROVIDER_PRESETS, testConnection } from "./ai";
import type AIClozePlugin from "./main";
import type { ProviderKind } from "./types";
import { applyLanguage, t } from "./i18n";
import { ClozeView, VIEW_TYPE_AI_CLOZE } from "./view";

export const DEFAULT_SETTINGS = {
  provider: {
    provider: "openai" as ProviderKind,
    baseUrl: PROVIDER_PRESETS.openai.baseUrl,
    apiKey: "",
    model: PROVIDER_PRESETS.openai.defaultModel,
    temperature: 0.3,
    maxTokens: 3000,
    useProxy: false,
  },
  defaultDensity: 60,
  language: "system" as "system" | "zh" | "en",
  autoCloze: false,
  backgroundCloze: false,
  backgroundScope: "all" as "all" | "tag" | "folder",
  backgroundTags: [] as string[],
  backgroundFolders: [] as string[],
  clozeCache: {},
  review: {},
};

/**
 * Declarative settings tab (Obsidian 1.13+).
 * getSettingDefinitions() drives rendering and settings search; simple fields
 * use built-in controls, and fields needing custom behavior (password input,
 * async buttons, footer) render imperatively via `render`.
 */
export class AIClozeSettingTab extends PluginSettingTab {
  plugin: AIClozePlugin;

  constructor(app: App, plugin: AIClozePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const p = this.plugin.settings.provider;
    return [
      {
        name: t("settings.languageName"),
        desc: t("settings.languageDesc"),
        control: {
          type: "dropdown",
          key: "language",
          options: {
            system: t("settings.languageSystem"),
            zh: "中文",
            en: "English",
          },
        },
      },
      {
        type: "group",
        heading: t("settings.providerName"),
        items: [
          {
            name: t("settings.providerName"),
            desc: t("settings.providerDesc"),
            control: {
              type: "dropdown",
              key: "provider.provider",
              options: Object.fromEntries(
                Object.keys(PROVIDER_PRESETS).map((k) => [k, t(`provider.${k}`)])
              ),
            },
          },
          {
            name: t("settings.baseUrlName"),
            desc: t("settings.baseUrlDesc"),
            control: {
              type: "text",
              key: "provider.baseUrl",
              placeholder: PROVIDER_PRESETS[p.provider].baseUrl,
            },
          },
          {
            name: t("settings.apiKeyName"),
            desc: t("settings.apiKeyDesc"),
            render: (setting) => {
              setting.addText((txt) => {
                txt.inputEl.type = "password";
                txt
                  .setPlaceholder("sk-…")
                  .setValue(this.plugin.settings.provider.apiKey)
                  .onChange(async (v) => {
                    this.plugin.settings.provider.apiKey = v.trim();
                    await this.plugin.saveData(this.plugin.settings);
                  });
              });
            },
          },
          {
            name: t("settings.modelName"),
            desc: t("settings.modelDesc"),
            control: {
              type: "text",
              key: "provider.model",
              placeholder: PROVIDER_PRESETS[p.provider].defaultModel,
            },
          },
          {
            name: t("settings.tempName"),
            desc: t("settings.tempDesc"),
            control: {
              type: "slider",
              key: "provider.temperature",
              min: 0,
              max: 1,
              step: 0.1,
            },
          },
          {
            name: t("settings.maxTokensName"),
            desc: t("settings.maxTokensDesc"),
            control: {
              type: "slider",
              key: "provider.maxTokens",
              min: 500,
              max: 8000,
              step: 500,
            },
          },
          {
            name: t("settings.testName"),
            desc: t("settings.testDesc"),
            render: (setting) => {
              setting.addButton((b) => {
                b.setButtonText(t("settings.testButton")).onClick(async () => {
                  b.setDisabled(true);
                  b.setButtonText(t("settings.testingButton"));
                  try {
                    const reply = await testConnection(this.plugin.settings.provider);
                    new Notice(`✅ ${t("msg.connectionOk")}: ${reply.slice(0, 80)}`, 6000);
                  } catch (e) {
                    new Notice(
                      `❌ ${t("msg.connectionFail")}: ${e instanceof Error ? e.message : String(e)}`,
                      10000
                    );
                  } finally {
                    b.setDisabled(false);
                    b.setButtonText(t("settings.testButton"));
                  }
                });
              });
            },
          },
        ],
      },
      {
        name: t("settings.densityName"),
        desc: t("settings.densityDesc"),
        control: {
          type: "slider",
          key: "defaultDensity",
          min: 0,
          max: 100,
          step: 5,
        },
      },
      {
        name: t("settings.autoClozeName"),
        desc: t("settings.autoClozeDesc"),
        control: { type: "toggle", key: "autoCloze" },
      },
      {
        name: t("settings.bgName"),
        desc: t("settings.bgDesc"),
        control: { type: "toggle", key: "backgroundCloze" },
      },
      {
        name: t("settings.bgScopeName"),
        desc: t("settings.bgScopeDesc"),
        control: {
          type: "dropdown",
          key: "backgroundScope",
          options: {
            all: t("settings.scopeAll"),
            tag: t("settings.scopeTag"),
            folder: t("settings.scopeFolder"),
          },
        },
      },
      {
        name: t("settings.bgTagName"),
        desc: t("settings.bgTagDesc"),
        control: {
          type: "text",
          key: "backgroundTags",
          placeholder: t("settings.bgTagPlaceholder"),
        },
        visible: () => this.plugin.settings.backgroundScope === "tag",
      },
      {
        name: t("settings.bgFolderName"),
        desc: t("settings.bgFolderDesc"),
        control: {
          type: "text",
          key: "backgroundFolders",
          placeholder: t("settings.bgFolderPlaceholder"),
        },
        visible: () => this.plugin.settings.backgroundScope === "folder",
      },
      {
        name: t("settings.clearName"),
        desc: t("settings.clearDesc"),
        render: (setting) => {
          setting.addButton((b) => {
            b.setButtonText(t("settings.clearButton")).setDestructive().onClick(async () => {
              this.plugin.settings.clozeCache = {};
              this.plugin.settings.review = {};
              await this.plugin.saveData(this.plugin.settings);
              new Notice(t("notice.memoryCleared"));
              this.update();
            });
          });
        },
      },
      {
        name: "",
        render: (setting) => {
          const root = this.app.vault.getRoot();
          setting.nameEl.remove();
          setting.descEl.setText(
            t("settings.footer", { path: root instanceof TFolder ? root.path : "/" })
          );
          setting.descEl.addClass("ac-settings-footer");
        },
      },
    ];
  }

  getControlValue(key: string): unknown {
    const s = this.plugin.settings;
    switch (key) {
      case "provider.provider":
        return s.provider.provider;
      case "provider.baseUrl":
        return s.provider.baseUrl;
      case "provider.model":
        return s.provider.model;
      case "provider.temperature":
        return s.provider.temperature;
      case "provider.maxTokens":
        return s.provider.maxTokens;
      case "language":
        return s.language;
      case "defaultDensity":
        return s.defaultDensity;
      case "autoCloze":
        return s.autoCloze;
      case "backgroundCloze":
        return s.backgroundCloze;
      case "backgroundScope":
        return s.backgroundScope;
      case "backgroundTags":
        return s.backgroundTags.join(", ");
      case "backgroundFolders":
        return s.backgroundFolders.join(", ");
      default:
        return undefined;
    }
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const s = this.plugin.settings;
    switch (key) {
      case "provider.provider": {
        const kind = value as ProviderKind;
        const presets = PROVIDER_PRESETS[kind];
        const prev = s.provider;
        // When switching provider, follow the new presets if baseUrl/model still match the old defaults
        s.provider = {
          ...prev,
          provider: kind,
          baseUrl:
            prev.baseUrl === PROVIDER_PRESETS[prev.provider].baseUrl
              ? presets.baseUrl
              : prev.baseUrl,
          model:
            prev.model === PROVIDER_PRESETS[prev.provider].defaultModel
              ? presets.defaultModel
              : prev.model,
        };
        break;
      }
      case "provider.baseUrl":
        s.provider.baseUrl =
          (value as string).trim() || PROVIDER_PRESETS[s.provider.provider].baseUrl;
        break;
      case "provider.model":
        s.provider.model =
          (value as string).trim() || PROVIDER_PRESETS[s.provider.provider].defaultModel;
        break;
      case "provider.temperature":
        s.provider.temperature = value as number;
        break;
      case "provider.maxTokens":
        s.provider.maxTokens = value as number;
        break;
      case "language":
        s.language = value as "system" | "zh" | "en";
        applyLanguage(s.language);
        break;
      case "defaultDensity":
        s.defaultDensity = value as number;
        break;
      case "autoCloze":
        s.autoCloze = value as boolean;
        break;
      case "backgroundCloze":
        s.backgroundCloze = value as boolean;
        break;
      case "backgroundScope":
        s.backgroundScope = value as "all" | "tag" | "folder";
        break;
      case "backgroundTags":
        s.backgroundTags = (value as string)
          .split(/[,，]/)
          .map((x) => x.trim())
          .filter(Boolean);
        break;
      case "backgroundFolders":
        s.backgroundFolders = (value as string)
          .split(/[,，]/)
          .map((x) => x.trim().replace(/^\/+|\/+$/g, ""))
          .filter(Boolean);
        break;
      default:
        return;
    }
    await this.plugin.saveData(this.plugin.settings);
    if (key === "backgroundScope" || key === "language") {
      // Re-evaluate visible predicates and re-render labels in the new language
      this.update();
    }
    if (key === "language") {
      this.app.workspace.getLeavesOfType(VIEW_TYPE_AI_CLOZE).forEach((leaf) => {
        void (leaf.view as ClozeView).refresh();
      });
    }
  }
}
