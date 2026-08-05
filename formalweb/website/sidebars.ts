import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: 'category',
      label: '概要',
      items: ['overview/introduction'],
    },
    {
      type: 'category',
      label: 'クイックスタート',
      items: ['getting-started/download'],
    },
    {
      type: 'category',
      label: '物理モデル詳細',
      items: [
        'physics-model/overview',
        'physics-model/assumuptions',
        'physics-model/input_and_parameters',
        'physics-model/lindblad',
        'physics-model/dissipation-model',
        {
          type: 'category',
          label: '制御モデル',
          items: [
            'physics-model/control_models/gate-awaremodel',
            'physics-model/control_models/pulse-levelmodel',
          ],
        },
        {
          type: 'category',
          label: '時間発展',
          items: [
            'physics-model/propagation/RK4',
            'physics-model/propagation/CPTP',
            'physics-model/propagation/statevector',
          ],
        },
        'physics-model/outputs',
        {
          type: 'category',
          label: '妥当性検証',
          items: [
            'physics-model/validations/index',
            'physics-model/validations/input',
            'physics-model/validations/propagation',
            'physics-model/validations/control-models',
            'physics-model/validations/hardware-comparison',
          ],
        },
        'physics-model/references',
      ],
    },
    {
      type: 'category',
      label: '制限事項',
      items: ['limitations/current-limitations'],
    },
  ],
};

export default sidebars;
