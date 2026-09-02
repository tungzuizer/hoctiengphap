/**
 * French Learning Web App - Configuration & Default Presets
 * Grille officielle DELF B1 (France Éducation International) & Seed Bank Data
 */

const CONFIG = {
  DEFAULT_OMNIROUTE_BASE_URL: 'http://localhost:20128/v1',
  DEFAULT_MODEL: 'antigravity/gemini-3.7-flash-tiered',
  DEFAULT_FALLBACK_MODEL: 'antigravity/gemini-3.7-flash-tiered',
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
  ],

  // Curated French Phonetics Essentials for Vietnamese Learners (Atelier Phonétique)
  FRENCH_PHONETICS_PRESETS: [
    {
      id: 'ph_u_vs_ou',
      category: 'Cặp âm phân biệt',
      title: 'Phân biệt Âm [y] (u) vs Âm [u] (ou)',
      badge: 'Cực kỳ quan trọng',
      description: 'Người Việt hay phát âm chữ "u" thành "u" tiếng Việt, dẫn đến nhầm lẫn nghiêm trọng giữa "tu" (bạn) và "tout" (tất cả).',
      mouthGuide: 'Để phát âm [y] (u): Đặt khẩu hình miệng phát âm chữ "i", sau đó giữ nguyên lưỡi và CHU TRÒN MÔI như huýt sáo.',
      pairs: [
        { french: 'tu', ipa: '/ty/', meaning: 'bạn (ngôi thứ 2)', compareWith: 'tout /tu/ (tất cả)' },
        { french: 'vu', ipa: '/vy/', meaning: 'đã thấy (voir)', compareWith: 'vous /vu/ (các bạn)' },
        { french: 'dessus', ipa: '/dəsy/', meaning: 'ở phía trên', compareWith: 'dessous /dəsu/ (ở phía dưới)' },
        { french: 'rue', ipa: '/ʁy/', meaning: 'con đường', compareWith: 'roue /ʁu/ (bánh xe)' }
      ]
    },
    {
      id: 'ph_nasal_vowels',
      category: 'Âm mũi (Voyelles nasales)',
      title: '4 Âm mũi đặc trưng tiếng Pháp [ɑ̃], [ɔ̃], [ɛ̃], [œ̃]',
      badge: 'Bản sắc tiếng Pháp',
      description: 'Âm mũi phát ra luồng hơi qua cả khoang miệng và mũi, không phát âm phụ âm n/m đứng sau.',
      mouthGuide: 'Hạ hàm mềm xuống để hơi thoát lên mũi. Tuyệt đối không khép môi tạo âm "m" hay "n" ở cuối.',
      pairs: [
        { french: 'un restaurant', ipa: '/œ̃ ʁɛstoʁɑ̃/', meaning: 'quán ăn', compareWith: 'Âm [ɑ̃] (an/en): mở miệng rộng' },
        { french: 'un bonbon', ipa: '/œ̃ bɔ̃bɔ̃/', meaning: 'kẹo', compareWith: 'Âm [ɔ̃] (on/om): chu môi tròn nhỏ' },
        { french: 'le matin et le pain', ipa: '/lə matɛ̃ e lə pɛ̃/', meaning: 'buổi sáng và bánh mì', compareWith: 'Âm [ɛ̃] (in/ain/ein): bè môi như cười' },
        { french: 'un parfum', ipa: '/œ̃ paʁfœ̃/', meaning: 'nước hoa', compareWith: 'Âm [œ̃] (un/um): mở tròn tự nhiên' }
      ]
    },
    {
      id: 'ph_guttural_r',
      category: 'Phụ âm họng',
      title: 'Âm [ʁ] (R rung cuống họng Paris)',
      badge: 'Âm Pháp chuẩn',
      description: 'Âm "r" tiếng Pháp không uốn cong đầu lưỡi như tiếng Việt/tiếng Anh, mà tạo ma sát ở đáy họng (vòm mềm).',
      mouthGuide: 'Đặt cuống lưỡi chạm nhẹ vào vòm mềm ở đáy cổ họng, thở đẩy luồng hơi nhẹ ra giống như súc miệng nhẹ nhàng.',
      pairs: [
        { french: 'Bonjour, merci', ipa: '/bɔ̃ʒuʁ mɛʁsi/', meaning: 'Xin chào, cảm ơn', compareWith: 'R rung nhẹ giữa từ' },
        { french: 'Paris et la France', ipa: '/paʁi e la fʁɑ̃s/', meaning: 'Paris và nước Pháp', compareWith: 'R đứng sau nguyên âm / phụ âm' },
        { french: 'regarder la radio', ipa: '/ʁəɡaʁde la ʁadjo/', meaning: 'xem / đài phát thanh', compareWith: 'R đứng đầu từ' }
      ]
    },
    {
      id: 'ph_liaisons',
      category: 'Nối âm & Ngữ điệu',
      title: 'Quy tắc Nối âm bắt buộc (Liaisons obligatoires)',
      badge: 'DELF B1',
      description: 'Nối phụ âm câm cuối từ trước với nguyên âm đầu của từ kế tiếp để câu nói mượt mà, lưu loát.',
      mouthGuide: 'Phụ âm -s/-x nối thành âm [z], -d nối thành âm [t], -n nối thành âm [n].',
      pairs: [
        { french: 'les‿amis', ipa: '/lez‿ami/', meaning: 'những người bạn', compareWith: '-s nối thành [z]' },
        { french: 'vous‿avez', ipa: '/vuz‿ave/', meaning: 'các bạn có', compareWith: '-s nối thành [z]' },
        { french: 'un‿enfant', ipa: '/œ̃.n‿ɑ̃fɑ̃/', meaning: 'một đứa trẻ', compareWith: '-n nối thành [n]' },
        { french: 'un grand‿homme', ipa: '/œ̃ ɡʁɑ̃.t‿ɔm/', meaning: 'một vĩ nhân', compareWith: '-d nối thành [t]' }
      ]
    },
    {
      id: 'ph_silent_letters',
      category: 'Phụ âm câm',
      title: 'Phụ âm cuối câm (Lettres finales muettes)',
      badge: 'Lỗi 90% người mới mắc',
      description: 'Các chữ p, d, t, s, x, z, g đứng cuối từ thường KHÔNG ĐƯỢC PHÁT ÂM (trừ khi nối âm).',
      mouthGuide: 'Dừng âm ngay tại nguyên âm trước đó, không phát âm âm gió hay bật âm thừa.',
      pairs: [
        { french: 'beaucoup', ipa: '/boku/', meaning: 'nhiều (chữ p câm)', compareWith: 'Không đọc "bô-cúp"' },
        { french: 'le temps', ipa: '/lə tɑ̃/', meaning: 'thời gian/thời tiết (p, s câm)', compareWith: 'Không đọc "tem-pơ"' },
        { french: 'ils parlent', ipa: '/il paʁl/', meaning: 'họ nói (đuôi -ent của động từ câm)', compareWith: 'Chỉ đọc đến âm /l/' },
        { french: 'très grand', ipa: '/tʁɛ ɡʁɑ̃/', meaning: 'rất to lớn (s, d câm)', compareWith: 'Không đọc "tơ-rét gơ-răng-đờ"' }
      ]
    }
  ],

  // Dynamic Speaking Topic Starters & Conversation Starters
  SPEAKING_TOPICS: [
    {
      id: 'food',
      icon: 'coffee',
      label: 'Ẩm thực & Bữa ăn',
      badge: 'Nourriture',
      prompt: 'Parlez-moi de vos plats français ou vietnamiens préférés et de vos habitudes culinaires.',
      starterFr: 'Bonjour ! Aujourd\'hui, je voudrais vous parler de mes plats préférés et de mes repas.',
      starterVi: 'Hôm nay tôi muốn nói về món ăn yêu thích và bữa ăn hàng ngày.'
    },
    {
      id: 'travel',
      icon: 'navigation',
      label: 'Du lịch & Kỳ nghỉ',
      badge: 'Voyages',
      prompt: 'Racontez-moi un voyage mémorable que vous avez fait ou votre prochaine destination de vacances.',
      starterFr: 'J\'adore voyager et j\'aimerais vous raconter mon dernier voyage mémorable.',
      starterVi: 'Tôi rất thích du lịch và muốn kể về chuyến đi đáng nhớ vừa qua.'
    },
    {
      id: 'work_study',
      icon: 'briefcase',
      label: 'Công việc & Học tập',
      badge: 'Travail',
      prompt: 'Présentez votre travail ou vos études : quelles sont vos responsabilités et vos projets ?',
      starterFr: 'Actuellement, je travaille et je prépare aussi mon projet professionnel en français.',
      starterVi: 'Hiện tại tôi đang làm việc và chuẩn bị kế hoạch nghề nghiệp.'
    },
    {
      id: 'daily_life',
      icon: 'home',
      label: 'Thói quen & Cuộc sống',
      badge: 'Quotidien',
      prompt: 'Comment se passe une journée typique pour vous du matin au soir ?',
      starterFr: 'Dans ma vie quotidienne, j\'ai l\'habitude de me lever tôt et d\'organiser ma journée.',
      starterVi: 'Trong cuộc sống thường nhật, tôi có thói quen dậy sớm và sắp xếp một ngày.'
    },
    {
      id: 'hobbies_arts',
      icon: 'music',
      label: 'Sở thích & Âm nhạc, Phim',
      badge: 'Loisirs',
      prompt: 'Quels sont vos loisirs favoris ? Aimez-vous le cinéma, la lecture ou la musique ?',
      starterFr: 'Pendant mon temps libre, j\'aime écouter de la musique et regarder des films.',
      starterVi: 'Vào thời gian rảnh, tôi thích nghe nhạc và xem phim.'
    },
    {
      id: 'future_plans',
      icon: 'target',
      label: 'Dự định & Tương lai',
      badge: 'Projets',
      prompt: 'Quels sont vos projets pour les prochaines années (voyages, carrière, apprentissage) ?',
      starterFr: 'Pour l\'avenir, j\'ai pour projet d\'obtenir le DELF B1 et de voyager à l\'étranger.',
      starterVi: 'Về tương lai, tôi có dự định thi đạt DELF B1 và đi nước ngoài.'
    },
    {
      id: 'delf_debate',
      icon: 'messageSquare',
      label: 'Bày tỏ quan điểm DELF B1',
      badge: 'Débat B1',
      prompt: 'Donnez votre avis sur un sujet d\'actualité : le télétravail, les transports écologiques ou la protection de l\'environnement.',
      starterFr: 'À mon avis, le développement des transports écologiques est essentiel pour notre avenir.',
      starterVi: 'Theo quan điểm của tôi, phát triển giao thông sinh thái là điều thiết yếu.'
    }
  ]
};

window.CONFIG = CONFIG;
