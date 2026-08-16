import {themes as prismThemes} from 'prism-react-renderer';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Yuragi-Strider',
  tagline: '物理環境が量子回路に与える影響を可視化するシミュレーター',
  favicon: 'img/favicon.svg',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // 本番URL。og:url / og:image / canonical はここから絶対URLが組まれるので、
  // 実際の配信ドメインと一致していないと SNS のカードが読み込めない。
  url: 'https://yuragi-strider.23sam55781.workers.dev',
  baseUrl: '/',

  onBrokenLinks: 'throw',

  // 本体アプリ (frontend/index.html) と同じ書体を読む。Archivo Black = macro
  // 見出し、JetBrains Mono = 計器ラベル / 数値、Inter = 本文。
  headTags: [
    {
      tagName: 'meta',
      attributes: {
        name: 'google-site-verification',
        content: 'uxEUHXelqrVlWkGvmS-Tm7Z11pr_vGnV9mixTRAkhrQ',
      },
    },
    {
      tagName: 'link',
      attributes: {rel: 'preconnect', href: 'https://fonts.googleapis.com'},
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossorigin: 'anonymous',
      },
    },
  ],

  stylesheets: [
    'https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;600;800;900&display=swap',
  ],

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. Content is authored in Japanese.
  i18n: {
    defaultLocale: 'ja',
    locales: ['ja'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
        },
        blog: false,

        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // SNS 等に貼られたときの og:image。既定の Docusaurus カードのままだと
    // 全ページが他製品の名前とマスコットで共有されるので、本体と同じ
    // substrate で作った 1200x630 のカードを使う。
    image: 'img/yuragi-strider-social-card.jpg',

    /*
     * 本体アプリは `color-scheme: dark` のダーク確定 UI なので、ドキュメント側も
     * ダーク固定にしてテーマ切替を出さない。明色テーマを残すと、同じ製品の中に
     * 2つの substrate が存在することになってしまう。
     */
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'Yuragi-Strider',
      logo: {
        alt: 'Yuragi-Strider Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'ドキュメント',
        },
        {
          to: '/docs/learn/',
          label: '理論を学ぶ',
          position: 'left',
        },
        {
          to: '/docs/physics-model/overview',
          label: '物理モデル',
          position: 'left',
        },
        {
          to: '/docs/physics-model/validations/',
          label: '妥当性検証',
          position: 'left',
        },
        {
          href: 'https://yuragi-strider-app.23sam55781.workers.dev',
          label: 'アプリを試してみる',
          position: 'right',
          className: 'navbar__item--app-cta',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'ドキュメント',
          items: [
            {
              label: 'Yuragi-Striderとは',
              to: '/docs/overview/introduction',
            },
            {
              label: 'ダウンロード',
              to: '/docs/getting-started/download',
            },
            {
              label: '制限事項',
              to: '/docs/limitations/current-limitations',
            },
          ],
        },
        {
          title: '物理モデル',
          items: [
            {
              label: '理論を学ぶ',
              to: '/docs/learn/',
            },
            {
              label: '物理モデルの概要',
              to: '/docs/physics-model/overview',
            },
            {
              label: '妥当性検証',
              to: '/docs/physics-model/validations/',
            },
            {
              label: '参考文献',
              to: '/docs/physics-model/references',
            },
          ],
        },
      ],
      // 本体ホームの colophon と同じ並び。
      copyright: `&copy; ${new Date().getFullYear()} YURAGI&ndash;STRIDER &nbsp;/&nbsp; NO WARRANTY &mdash; RESEARCH INSTRUMENT`,
    },
    prism: {
      // ダーク確定なので明色テーマは使わない。vsDark が void substrate に一番近い。
      theme: prismThemes.vsDark,
      darkTheme: prismThemes.vsDark,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
