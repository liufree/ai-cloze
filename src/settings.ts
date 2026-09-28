import { App, Notice, PluginSettingTab, Setting, TFolder } from "obsidian";
import { PROVIDER_PRESETS, testConnection } from "./ai";
import type AIClozePlugin from "./main";
import type { ProviderKind } from "./types";

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
    containerEl.createEl("h2", { text: "ai-cloze · AI 挖空阅读" });

    new Setting(containerEl)
      .setName("Provider")
      .setDesc("选择 AI 服务商。OpenAI 兼容接口可用于 OpenAI / DeepSeek / Moonshot 等；Ollama 为本地模型。")
      .addDropdown((dd) => {
        dd.addOptions(
          Object.fromEntries(
            Object.entries(PROVIDER_PRESETS).map(([k, v]) => [k, v.label])
          )
        )
          .setValue(this.plugin.settings.provider.provider)
          .onChange(async (val) => {
            const kind = val as ProviderKind;
            const presets = PROVIDER_PRESETS[kind];
            const prev = this.plugin.settings.provider;
            // 切换服务商时：若 baseUrl 仍是旧预设默认值，则跟随新预设
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
      .setName("API 地址（Base URL）")
      .setDesc("OpenAI 兼容端点，如 https://api.openai.com/v1 或 http://localhost:11434/v1（Ollama）")
      .addText((t) =>
        t
          .setPlaceholder(PROVIDER_PRESETS[this.plugin.settings.provider.provider].baseUrl)
          .setValue(this.plugin.settings.provider.baseUrl)
          .onChange(async (v) => {
            this.plugin.settings.provider.baseUrl = v.trim() || PROVIDER_PRESETS[this.plugin.settings.provider.provider].baseUrl;
            await this.plugin.saveData(this.plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("本地 Ollama 可留空。密钥仅保存在本机 data.json。")
      .addText((t) => {
        t.inputEl.type = "password";
        return t
          .setPlaceholder("sk-…")
          .setValue(this.plugin.settings.provider.apiKey)
          .onChange(async (v) => {
            this.plugin.settings.provider.apiKey = v.trim();
            await this.plugin.saveData(this.plugin.settings);
          });
      });

    new Setting(containerEl)
      .setName("模型（Model）")
      .setDesc("例如 gpt-4o-mini / claude-3-5-haiku-latest / qwen2.5:7b")
      .addText((t) =>
        t
          .setPlaceholder(PROVIDER_PRESETS[this.plugin.settings.provider.provider].defaultModel)
          .setValue(this.plugin.settings.provider.model)
          .onChange(async (v) => {
            this.plugin.settings.provider.model = v.trim() || PROVIDER_PRESETS[this.plugin.settings.provider.provider].defaultModel;
            await this.plugin.saveData(this.plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName("温度（Temperature）")
      .setDesc("越低越稳定。挖空推荐 0.1 - 0.5。")
      .addSlider((sl) =>
        sl
          .setLimits(0, 1, 0.1)
          .setValue(this.plugin.settings.provider.temperature)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.provider.temperature = v;
            await this.plugin.saveData(this.plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName("最大输出 Token")
      .setDesc("AI 返回挖空列表的最大 token 数。")
      .addSlider((sl) =>
        sl
          .setLimits(500, 8000, 500)
          .setValue(this.plugin.settings.provider.maxTokens)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.provider.maxTokens = v;
            await this.plugin.saveData(this.plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName("测试 AI 连通性")
      .setDesc("发送一个极小请求，验证 API 地址、Key 与模型是否可用（几乎不消耗 token）。")
      .addButton((b) =>
        b.setButtonText("测试连通").onClick(async () => {
          b.setDisabled(true);
          b.setButtonText("测试中…");
          try {
            const reply = await testConnection(this.plugin.settings.provider);
            new Notice(`✅ AI 连通成功：${reply.slice(0, 80)}`, 6000);
          } catch (e) {
            new Notice(`❌ 连通失败：${e instanceof Error ? e.message : String(e)}`, 10000);
          } finally {
            b.setDisabled(false);
            b.setButtonText("测试连通");
          }
        })
      );

    new Setting(containerEl)
      .setName("默认挖空密度")
      .setDesc("0-100，默认每次打开时挖空的比例。可在阅读视图中单独调整。")
      .addSlider((sl) =>
        sl
          .setLimits(0, 100, 5)
          .setValue(this.plugin.settings.defaultDensity)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.defaultDensity = v;
            await this.plugin.saveData(this.plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName("自动挖空（打开视图时）")
      .setDesc("开启后，打开挖空视图时若该笔记没有缓存，会自动调用 AI 生成。长文会消耗大量 token，请按需开启。")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.autoCloze).onChange(async (v) => {
          this.plugin.settings.autoCloze = v;
          await this.plugin.saveData(this.plugin.settings);
        })
      );

    new Setting(containerEl)
      .setName("后台预生成")
      .setDesc("独立开关：无需打开挖空视图，切换到符合条件的笔记时就在后台预生成缓存，点开视图即可直接看到结果。")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.backgroundCloze).onChange(async (v) => {
          this.plugin.settings.backgroundCloze = v;
          await this.plugin.saveData(this.plugin.settings);
        })
      );

    new Setting(containerEl)
      .setName("后台预生成范围")
      .setDesc("选择后台预生成适用哪些笔记，避免对所有笔记都消耗 token。")
      .addDropdown((dd) =>
        dd
          .addOption("all", "全部笔记")
          .addOption("tag", "仅指定标签")
          .addOption("folder", "仅指定文件夹")
          .setValue(this.plugin.settings.backgroundScope)
          .onChange(async (v) => {
            this.plugin.settings.backgroundScope = v as "all" | "tag" | "folder";
            await this.plugin.saveData(this.plugin.settings);
            this.display();
          })
      );

    if (this.plugin.settings.backgroundScope === "tag") {
      new Setting(containerEl)
        .setName("后台预生成标签")
        .setDesc("逗号分隔的标签（# 可省略，支持子标签前缀，如「学习」匹配「学习/xxx」）。留空则不预生成。")
        .addText((t) =>
          t
            .setPlaceholder("学习, 待复习")
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
        .setName("后台预生成文件夹")
        .setDesc("逗号分隔的文件夹路径（相对库根，如「03-领域/编程」）。留空则不预生成。")
        .addText((t) =>
          t
            .setPlaceholder("03-领域, 05-学习")
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
      .setName("清除全部记忆数据")
      .setDesc("删除所有笔记的挖空缓存与复习进度（不会改动笔记文件）。")
      .addButton((b) =>
        b.setButtonText("清空").setWarning().onClick(async () => {
          this.plugin.settings.clozeCache = {};
          this.plugin.settings.review = {};
          await this.plugin.saveData(this.plugin.settings);
          new Notice("ai-cloze 记忆数据已清空");
          this.display();
        })
      );

    this.containerEl.createEl("hr");
    this.containerEl.createEl("p", {
      text: `当前库：${(this.app.vault.getRoot() as TFolder).path || "/"} · 数据保存在插件 data.json`,
      attr: { style: "color: var(--text-muted); font-size: var(--font-smallest);" },
    });
  }
}
