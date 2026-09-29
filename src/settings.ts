import { App, Notice, PluginSettingTab, Setting, TFolder } from "obsidian";
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

export class AIClozeSettingTab extends PluginSettingTab {
  plugin: AIClozePlugin;

  constructor(app: App, plugin: AIClozePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName(t("settings.title")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.languageName"))
      .setDesc(t("settings.languageDesc"))
      .addDropdown((dd) =>
        dd
          .addOption("system", t("settings.languageSystem"))
          .addOption("zh", "中文")
          .addOption("en", "English")
          .setValue(this.plugin.settings.language)
          .onChange(async (v) => {
            const lang = v as "system" | "zh" | "en";
            this.plugin.settings.language = lang;
            await this.plugin.saveData(this.plugin.settings);
            applyLanguage(lang);
            this.display();
            // make already-open cloze views switch language immediately
            this.plugin.app.workspace
              .getLeavesOfType(VIEW_TYPE_AI_CLOZE)
              .forEach((leaf) => {
                void (leaf.view as ClozeView).refresh();
              });
          })
      );

    new Setting(containerEl)
      .setName(t("settings.providerName"))
      .setDesc(t("settings.providerDesc"))
      .addDropdown((dd) => {
        dd.addOptions(
          Object.fromEntries(
            Object.keys(PROVIDER_PRESETS).map((k) => [k, t(`provider.${k}`)])
          )
        )
          .setValue(this.plugin.settings.provider.provider)
          .onChange(async (val) => {
            const kind = val as ProviderKind;
            const presets = PROVIDER_PRESETS[kind];
            const prev = this.plugin.settings.provider;
            // when switching providers: if baseUrl is still the old preset default, follow the new preset
            this.plugin.settings.provider = {
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
            await this.plugin.saveData(this.plugin.settings);
            this.display();
          });
      });

    new Setting(containerEl)
      .setName(t("settings.baseUrlName"))
      .setDesc(t("settings.baseUrlDesc"))
      .addText((txt) =>
        txt
          .setPlaceholder(PROVIDER_PRESETS[this.plugin.settings.provider.provider].baseUrl)
          .setValue(this.plugin.settings.provider.baseUrl)
          .onChange(async (v) => {
            this.plugin.settings.provider.baseUrl = v.trim() || PROVIDER_PRESETS[this.plugin.settings.provider.provider].baseUrl;
            await this.plugin.saveData(this.plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName(t("settings.apiKeyName"))
      .setDesc(t("settings.apiKeyDesc"))
      .addText((txt) => {
        txt.inputEl.type = "password";
        return txt
          .setPlaceholder("sk-…")
          .setValue(this.plugin.settings.provider.apiKey)
          .onChange(async (v) => {
            this.plugin.settings.provider.apiKey = v.trim();
            await this.plugin.saveData(this.plugin.settings);
          });
      });

    new Setting(containerEl)
      .setName(t("settings.modelName"))
      .setDesc(t("settings.modelDesc"))
      .addText((txt) =>
        txt
          .setPlaceholder(PROVIDER_PRESETS[this.plugin.settings.provider.provider].defaultModel)
          .setValue(this.plugin.settings.provider.model)
          .onChange(async (v) => {
            this.plugin.settings.provider.model = v.trim() || PROVIDER_PRESETS[this.plugin.settings.provider.provider].defaultModel;
            await this.plugin.saveData(this.plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName(t("settings.tempName"))
      .setDesc(t("settings.tempDesc"))
      .addSlider((sl) =>
        sl
          .setLimits(0, 1, 0.1)
          .setValue(this.plugin.settings.provider.temperature)
          .onChange(async (v) => {
            this.plugin.settings.provider.temperature = v;
            await this.plugin.saveData(this.plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName(t("settings.maxTokensName"))
      .setDesc(t("settings.maxTokensDesc"))
      .addSlider((sl) =>
        sl
          .setLimits(500, 8000, 500)
          .setValue(this.plugin.settings.provider.maxTokens)
          .onChange(async (v) => {
            this.plugin.settings.provider.maxTokens = v;
            await this.plugin.saveData(this.plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName(t("settings.testName"))
      .setDesc(t("settings.testDesc"))
      .addButton((b) =>
        b.setButtonText(t("settings.testButton")).onClick(async () => {
          b.setDisabled(true);
          b.setButtonText(t("settings.testingButton"));
          try {
            const reply = await testConnection(this.plugin.settings.provider);
            new Notice(`✅ ${t("msg.connectionOk")}: ${reply.slice(0, 80)}`, 6000);
          } catch (e) {
            new Notice(`❌ ${t("msg.connectionFail")}: ${e instanceof Error ? e.message : String(e)}`, 10000);
          } finally {
            b.setDisabled(false);
            b.setButtonText(t("settings.testButton"));
          }
        })
      );

    new Setting(containerEl)
      .setName(t("settings.densityName"))
      .setDesc(t("settings.densityDesc"))
      .addSlider((sl) =>
        sl
          .setLimits(0, 100, 5)
          .setValue(this.plugin.settings.defaultDensity)
          .onChange(async (v) => {
            this.plugin.settings.defaultDensity = v;
            await this.plugin.saveData(this.plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName(t("settings.autoClozeName"))
      .setDesc(t("settings.autoClozeDesc"))
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.autoCloze).onChange(async (v) => {
          this.plugin.settings.autoCloze = v;
          await this.plugin.saveData(this.plugin.settings);
        })
      );

    new Setting(containerEl)
      .setName(t("settings.bgName"))
      .setDesc(t("settings.bgDesc"))
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.backgroundCloze).onChange(async (v) => {
          this.plugin.settings.backgroundCloze = v;
          await this.plugin.saveData(this.plugin.settings);
        })
      );

    new Setting(containerEl)
      .setName(t("settings.bgScopeName"))
      .setDesc(t("settings.bgScopeDesc"))
      .addDropdown((dd) =>
        dd
          .addOption("all", t("settings.scopeAll"))
          .addOption("tag", t("settings.scopeTag"))
          .addOption("folder", t("settings.scopeFolder"))
          .setValue(this.plugin.settings.backgroundScope)
          .onChange(async (v) => {
            this.plugin.settings.backgroundScope = v as "all" | "tag" | "folder";
            await this.plugin.saveData(this.plugin.settings);
            this.display();
          })
      );

    if (this.plugin.settings.backgroundScope === "tag") {
      new Setting(containerEl)
        .setName(t("settings.bgTagName"))
        .setDesc(t("settings.bgTagDesc"))
        .addText((txt) =>
          txt
            .setPlaceholder(t("settings.bgTagPlaceholder"))
            .setValue(this.plugin.settings.backgroundTags.join(", "))
            .onChange(async (v) => {
              this.plugin.settings.backgroundTags = v
                .split(/[,，]/)
                .map((s) => s.trim())
                .filter(Boolean);
              await this.plugin.saveData(this.plugin.settings);
            })
        );
    }

    if (this.plugin.settings.backgroundScope === "folder") {
      new Setting(containerEl)
        .setName(t("settings.bgFolderName"))
        .setDesc(t("settings.bgFolderDesc"))
        .addText((txt) =>
          txt
            .setPlaceholder(t("settings.bgFolderPlaceholder"))
            .setValue(this.plugin.settings.backgroundFolders.join(", "))
            .onChange(async (v) => {
              this.plugin.settings.backgroundFolders = v
                .split(/[,，]/)
                .map((s) => s.trim().replace(/^\/+|\/+$/g, ""))
                .filter(Boolean);
              await this.plugin.saveData(this.plugin.settings);
            })
        );
    }

    new Setting(containerEl)
      .setName(t("settings.clearName"))
      .setDesc(t("settings.clearDesc"))
      .addButton((b) =>
        b.setButtonText(t("settings.clearButton")).setDestructive().onClick(async () => {
          this.plugin.settings.clozeCache = {};
          this.plugin.settings.review = {};
          await this.plugin.saveData(this.plugin.settings);
          new Notice(t("notice.memoryCleared"));
          this.display();
        })
      );

    this.containerEl.createEl("hr");
    const root = this.app.vault.getRoot();
    this.containerEl.createEl("p", {
      text: t("settings.footer", { path: root instanceof TFolder ? root.path : "/" }),
      attr: { style: "color: var(--text-muted); font-size: var(--font-smallest);" },
    });
  }
}
