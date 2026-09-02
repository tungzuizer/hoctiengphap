/**
 * French Learning Web App - Configuration & Default Presets
 * Grille officielle DELF B1 (France Éducation International) & Seed Bank Data
 */

const CONFIG = {
  DEFAULT_OMNIROUTE_BASE_URL: 'https://api.omniroute.io/v1',
  DEFAULT_MODEL: 'claude-3-7-sonnet',
  DEFAULT_FALLBACK_MODEL: 'gpt-4o-mini',
  DEFAULT_LEVEL: 'B1',
  SPEECH_LANG: 'fr-FR',
  VOICE_NAME_PREFERENCES: ['Thomas', 'Amelie', 'Nicolas', 'Virginie', 'Google français', 'French', 'Hortense', 'Julie'],

  // Official DELF B1 Speaking Assessment Grid (Grille d'évaluation DELF B1) - Total 25 points
  DELF_B1_CRITERIA: [
    {
      id: 'entretien_dirige',
      group: 'task',
      label: 'Entretien dirigé (2-3 min)',
      description: 'Khả năng giới thiệu bản thân, nói về kinh nghiệm cá nhân, phản hồi tự nhiên về các chủ đề quen thuộc.',
      maxPoints: 4,
      b1Points: 2.5,
      b1PlusPoints: 4.0
    },
    {
      id: 'exercice_interaction',
      group: 'task',
      label: 'Exercice en interaction (3-4 min)',
      description: 'Khả năng xử lý tình huống giao tiếp thường ngày, đàm phán, giải quyết vấn đề, thể hiện cảm xúc/ý kiến.',
      maxPoints: 4,
      b1Points: 2.5,
      b1PlusPoints: 4.0
    },
    {
      id: 'expression_point_de_vue',
      group: 'task',
      label: 'Expression d\'un point de vue (5-7 min)',
      description: 'Khả năng trình bày quan điểm cá nhân rõ ràng về một chủ đề xã hội, nêu luận điểm và ví dụ minh họa.',
      maxPoints: 4,
      b1Points: 2.5,
      b1PlusPoints: 4.0
    },
    {
      id: 'lexique',
      group: 'language',
      label: 'Lexique (Từ vựng & Độ chính xác)',
      description: 'Vốn từ vựng phong phú, sử dụng đúng ngữ cảnh, diễn đạt linh hoạt các ý tưởng thường nhật và trừu tượng vừa phải.',
      maxPoints: 5,
      b1Points: 3.0,
      b1PlusPoints: 5.0
    },
    {
      id: 'morphosyntaxe',
      group: 'language',
      label: 'Morphosyntaxe (Ngữ pháp & Cấu trúc câu)',
      description: 'Sử dụng tốt các thì (passé composé, imparfait, futur, subjonctif cơ bản), cấu trúc câu liên kết chặt chẽ.',
      maxPoints: 4,
      b1Points: 2.5,
      b1PlusPoints: 4.0
    },
    {
      id: 'phonologie',
      group: 'language',
      label: 'Maîtrise du système phonologique (Phát âm & Ngữ điệu)',
      description: 'Phát âm rõ ràng, chuẩn âm tiếng Pháp (r, u, nasal vowels), ngữ điệu tự nhiên, dễ hiểu với người bản ngữ.',
      maxPoints: 4,
      b1Points: 2.5,
      b1PlusPoints: 4.0
    }
  ],

  // Simplified criteria for A1 / A2
  DELF_A1_A2_CRITERIA: [
    {
      id: 'lexique',
      group: 'language',
      label: 'Lexique (Từ vựng)',
      description: 'Sử dụng các từ vựng và cụm từ cơ bản phù hợp với chủ đề giao tiếp hằng ngày.',
      maxPoints: 5
    },
    {
      id: 'morphosyntaxe',
      group: 'language',
      label: 'Morphosyntaxe (Ngữ pháp)',
      description: 'Cấu trúc câu đơn giản, sử dụng các thì cơ bản (présent, passé composé).',
      maxPoints: 5
    },
    {
      id: 'phonologie',
      group: 'language',
      label: 'Phát âm & Độ trôi chảy',
      description: 'Phát âm rõ ràng, có thể hiểu được dù còn một số lỗi ngập ngừng hoặc phát âm sai âm khó.',
      maxPoints: 5
    }
  ],

  // Curated authentic Seed Bank data (RFI, TV5MONDE, France Éducation International)
  DEFAULT_SEEDS: [
    {
      id: 'seed_rfi_1',
      title: 'RFI - La transition écologique dans les transports',
      source: 'Le français facile avec RFI',
      sourceUrl: 'https://francaisfacile.rfi.fr',
      level: 'B1',
      topic: 'Môi trường & Đô thị',
      transcript: `De plus en plus de grandes villes européennes décident de limiter la circulation automobile pour réduire la pollution de l'air. À Paris, plusieurs voies sur berge ont été piétonnisées et les pistes cyclables se multiplient. Les usagers s'adaptent progressivement, privilégiant les vélos électriques et les transports en commun. Cependant, certains commerçants s'inquiètent de la baisse de fréquentation de leurs magasins, affirmant que leurs clients habituels viennent souvent de la banlieue en voiture.`
    },
    {
      id: 'seed_tv5_1',
      title: 'TV5MONDE - Le télétravail et l\'équilibre de vie',
      source: 'Apprendre TV5MONDE',
      sourceUrl: 'https://apprendre.tv5monde.com',
      level: 'B1',
      topic: 'Công việc & Xã hội',
      transcript: `Depuis la crise sanitaire, le télétravail s'est durablement installé dans les entreprises françaises. Si beaucoup de salariés apprécient le gain de temps lié à l'absence de trajets quotidiens, d'autres soulignent les risques d'isolement et la difficulté à séparer vie professionnelle et vie personnelle. Les syndicats et la direction négocient désormais des chartes sur le droit à la déconnexion pour garantir le repos des employés.`
    },
    {
      id: 'seed_delf_b1_sample',
      title: 'France Éducation International - Partir vivre à l\'étranger',
      source: 'France Éducation International (DELF B1 mẫu)',
      sourceUrl: 'https://www.france-education-international.fr',
      level: 'B1',
      topic: 'Du lịch & Định cư',
      transcript: `Chaque année, des milliers de jeunes francophones choisissent de vivre une expérience d'expatriation ou d'études à l'étranger. Les avantages sont nombreux : apprentissage d'une nouvelle langue, découverte d'une autre culture et enrichissement du parcours professionnel. Malgré tout, l'éloignement familial et le choc culturel peuvent représenter des défis importants pendant les premiers mois.`
    },
    {
      id: 'seed_rfi_a2_1',
      title: 'RFI - La Fête de la Musique en France',
      source: 'Le français facile avec RFI',
      sourceUrl: 'https://francaisfacile.rfi.fr',
      level: 'A2',
      topic: 'Văn hóa & Lễ hội',
      transcript: `Le 21 juin, partout en France, c'est la Fête de la Musique. Tous les musiciens, professionnels et amateurs, jouent gratuitement dans les rues, les places et les parcs. Les gens sortent en famille ou avec des amis pour écouter différents styles de musique comme le rock, le jazz et la chanson française.`
    }
  ]
};

window.CONFIG = CONFIG;
