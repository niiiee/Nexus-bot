# Nexus Community Rules (القواعد الخمسون للمجتمع)
*Version: 2.0.0 — Adopted by Community Consensus*
*Bilingual Source of Truth: English & Egyptian Arabic (معتمد رسمياً)*

---

## 🏛️ Rule Architecture & Severity Matrix

Every rule belongs to a Severity Class (S1–S4) with a hard-coded Enforcement Mode (A/S/H/C) and points decay schedule:

| Severity | Description | Points | Expiry / Decay | Allowed Automated Actions (Mode Guard) | Escalation Path |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **S1: Minor** | Low-harm friction, formatting, channel misuse | 1 pt | 30 days | **Mode A (Automated)**: Delete message, reminder, warning, max 1-hour timeout | Self-resolving, 3x S1 escalates to staff review |
| **S2: Moderate** | Bad-faith arguments, unverified claims, disruption | 2 pts | 60 days | **Mode S (Supervisory)**: Hide content, open case, require clarification | Staff review if 2x S2 within 60 days |
| **S3: Serious** | Plagiarism, harassment, NDA leaks, voting fraud | 4 pts | 90 days | **Mode H (Hold)**: Protective hold, queue for staff review (NO auto-ban) | Mandatory Human Review |
| **S4: Critical** | Doxxing, malware, violence, minor safety, fraud | — | Immediate | **Mode H (Hold)**: Immediate protective isolation, evidence snapshot, alert staff | Mandatory Dual-Moderator Human Review |
| **Care (R24)** | Distress, mental health crisis, self-harm signals | **0 pts** | — | **Mode C (Care)**: Compassionate hotline outreach, designated care mod alert | Strictly NO punitive action or points |

---

## 📜 The 50 Adopted Community Rules (R01 to R50)

### Group 1: Communication, Respect & Conduct (R01 - R10)
- **R01 [S1, Mode A] Spam & Repetitive Messages (الرسائل المكررة والسبام)**
  - *EN*: Do not flood channels with repeated messages, identical links, or meaningless text walls.
  - *AR*: ممنوع تكرار نفس الرسالة أو الروابط العشوائية أو إغراق الرومات بنصوص ملهاش لازمة.
  - *Action*: Message deletion + gentle reminder. Repeated -> Warning + 1 pt.

- **R02 [S3, Mode H] Hate Speech & Bigotry (خطاب الكراهية والتمييز)**
  - *EN*: Zero tolerance for slurs, discrimination, or degrading language based on race, religion, nationality, disability, gender, or dialect.
  - *AR*: مرفوض تماماً أي كلام فيه تمييز، إهانة، أو كراهية بسبب الدين، الجنسية، اللهجة، أو أي خلفية شخصية.
  - *Action*: Message hidden + Protective hold + Staff Case opened. (Never auto-banned; human review required).

- **R03 [S3, Mode H] Harassment, Bullying & Dogpiling (المضايقات والتنمر المستمر)**
  - *EN*: Do not repeatedly target, mock, intimidate, or orchestrate group attacks against any member across channels.
  - *AR*: ممنوع استهداف أي عضو بالسخرية أو التخويف أو التحريض عليه في الرومات العامة أو الخاصة.
  - *Action*: Protective hold on offending content + Staff Case opened + 4 pts.

- **R04 [S4, Mode H] Doxxing & Non-Consensual PII (نشر البيانات الشخصية والخصوصية)**
  - *EN*: Never post real names, home addresses, phone numbers, National IDs, or private photos without explicit verifiable consent.
  - *AR*: نشر أرقام تليفونات، بطاقات رقم قومي، عناوين، أو صور خاصة بدون إذن صاحبها ممنوع نهائياً.
  - *Action*: Immediate content purge + Account hold + Emergency staff alert.

- **R05 [S4, Mode H] Scams, Phishing & Deceptive Links (الاحتيال وروابط التصيد)**
  - *EN*: Do not share phishing links, fake Discord Nitro gifts, cryptocurrency scams, or malicious financial schemes.
  - *AR*: ممنوع نشر لينكات وهمية، سرقة حسابات، عروض نيترو مفبركة، أو أي نصب مالي.
  - *Action*: Immediate deletion + Protective account hold + Case logged.

- **R06 [S3, Mode H] Staff & Member Impersonation (انتحال شخصية الإدارة أو الأعضاء)**
  - *EN*: Do not copy usernames, avatars, or roles to pose as staff, moderators, clients, or specific community members.
  - *AR*: ممنوع استخدام أسامي وصور مطابقة للمشرفين أو الأعضاء عشان توهم الناس إنك الإدارة.
  - *Action*: Nickname/avatar reset + Case opened + 4 pts.

- **R07 [S3, Mode S] NSFW & Inappropriate Adult Content (المحتوى الإباحي وغير اللائق)**
  - *EN*: Do not post pornography, sexually explicit media, gore, or graphic violence.
  - *AR*: السيرفر مجتمع تقني وتعليمي، ممنوع نشر أي محتوى إباحي أو دموي أو خادش للحياء.
  - *Action*: Message deletion + Warning + 4 pts.

- **R08 [S4, Mode H] Malware, Exploits & Token Stealers (البرمجيات الخبيثة والملفات الضارة)**
  - *EN*: Do not distribute viruses, keyloggers, token grabbers, or links designed to compromise member devices.
  - *AR*: ممنوع نشر ملفات مشبوهة، تروجان، سارقات توكن، أو أي كود بيضر جهاز المستخدم.
  - *Action*: Content scrubbed + Isolation hold + Immediate emergency review.

- **R09 [S4, Mode H] Extortion, Blackmail & Coercion (الابتزاز والتهديد والضغط)**
  - *EN*: Threatening to leak files, damage reputations, or sabotage work to force compliance is strictly prohibited.
  - *AR*: ممنوع ابتزاز أي فريلانسر أو عميل أو التهديد بنشر شغله أو سمعته عشان تجبره على حاجة.
  - *Action*: Emergency hold + Staff case.

- **R10 [S4, Mode H] Violent Threats & Self-Harm Incitement (التهديد بالعنف أو التحريض على الأذى)**
  - *EN*: Do not threaten physical violence against others or encourage self-harm.
  - *AR*: أي تهديد بالاعتداء الجسدي أو تشجيع على إيذاء النفس بيترتب عليه إيقاف فوري وتدخل المشرفين.
  - *Action*: Immediate containment + Emergency staff alert.

---

### Group 2: Integrity, Freelancing & Portfolio (R11 - R20)
- **R11 [S3, Mode S] Portfolio Plagiarism & Credit Theft (سرقة الأعمال والادعاء الكاذب)**
  - *EN*: Do not present someone else's code, design, or case study as your own original work.
  - *AR*: ممنوع تنسب شغل غيرك لنفسك في البورتفوليو أو تدعي إنك عملت مشروع أنت ملمستوش.
  - *Action*: Advisory review opened + Evidence collected + Portfolio badge suspended pending verification.

- **R12 [S3, Mode H] Live Skill Test Cheating (الغش في اختبارات المهارة الحية)**
  - *EN*: Do not use ghostwriters, shared screens, or unauthorized remote assistance during live coding/design skill evaluations.
  - *AR*: ممنوع الاستعانة بحد يحل مكانك أو يكتبلك الكود في اختبار المهارة الحي الخاص بالسيرفر.
  - *Action*: Test invalidated + Larper restriction + Human review.

- **R13 [S2, Mode S] Fabricated Seniority Claims (تضخيم الخبرة والادعاءات غير الحقيقية)**
  - *EN*: Do not make fraudulent claims of years of senior experience to mislead beginners or clients.
  - *AR*: اتكلم عن خبرتك بصدق، بلاش تدعي سنين خبرة مش حقيقية علشان توهم الناس أو العملاء.
  - *Action*: Advisory probe + Role adjustment request + 2 pts.

- **R14 [S3, Mode H] Ban / Restriction Evasion (الهروب من العقوبات بحسابات بديلة)**
  - *EN*: Creating alt accounts to bypass a temporary restriction or moderation hold is forbidden.
  - *AR*: لو واخد عقوبة مؤقتة، بلاش تدخل بحساب تاني تهرب منها؛ دا بيضاعف المشكلة.
  - *Action*: Alt account linked + Restriction consolidated + Staff notification.

- **R15 [S2, Mode A] Event & Voice Stage Disruption (تخريب الفعاليات والرومات الصوتية)**
  - *EN*: Do not yell, play loud soundboards, interrupt guest speakers, or disrupt community workshops.
  - *AR*: احترم وقت الناس في الرومات الصوتية والورش، بلاش تشغيل أصوات مزعجة أو مقاطعة المحاضر.
  - *Action*: Server mute/disconnect + Warning + 2 pts.

- **R16 [S1, Mode A] Bot Command Abuse & Flood (إساءة استخدام أوامر البوت)**
  - *EN*: Do not spam slash commands, trigger infinite test loops, or intentionally try to crash community bots.
  - *AR*: بلاش سبام أوامر البوت في الشاتات العامة أو محاولة استهلاك الكوتة باستهبال.
  - *Action*: Command cooldown applied + Reminder + 1 pt.

- **R17 [S3, Mode S] Charter Violation: Selling Core Features (بيع المزايا المجانية ومخالفة الميثاق)**
  - *EN*: Core platform features (verification, learning, jobs, escrow) are free forever. Selling access is prohibited.
  - *AR*: خدمات نيكسس الأساسية مجانية للكل للأبد؛ ممنوع منعاً باتاً بيع أي ميزة أو فرض رسوم خاصة عليها.
  - *Action*: Feature locked to open state + Owner alerted + 4 pts.

- **R18 [S4, Mode H] Charter Violation: Bribery & Pay-to-Win (دفع رشاوي أو شراء رتب وتأثير)**
  - *EN*: Donations confer ZERO perks, roles, or votes. Offering money to influence moderation or rulings is banned.
  - *AR*: التبرع لصندوق المجتمع مش بيديك أي أفضلية ولا رتبة؛ ممنوع عرض فلوس لتغيير أي قرار.
  - *Action*: Transaction reversed + Donor Fairness Guard triggered + Full investigation.

- **R19 [S3, Mode S] Client Confidentiality & NDA Leaks (تسريب أسرار العملاء وملفاتهم)**
  - *EN*: Do not disclose private client source code, credentials, or proprietary business details without consent.
  - *AR*: حافظ على أمانة شغلك؛ ممنوع نشر كود خاص أو بيانات سرية لعميل بدون موافقته الصريحة.
  - *Action*: Post removed + Mediation advisory + 4 pts.

- **R20 [S2, Mode S] Off-Platform Payment Coercion (إجبار الفريلانسر على طرق دفع غير آمنة)**
  - *EN*: Clients must not coerce freelancers into unverified payment rails or bypass agreed escrow terms.
  - *AR*: ممنوع العميل يضغط على الفريلانسر عشان يستلم بطرق مش متفق عليها أو يتهرب من الإسكرو.
  - *Action*: Deal flagged + Advisory hold + 2 pts.

---

### Group 3: Market Fair-Play, Wellness & Safety (R21 - R30)
- **R21 [S3, Mode S] Fraudulent Job Postings & Unpaid Spec Work (الوظائف الوهمية والشغل المجاني)**
  - *EN*: Job posts demanding free full deliverables as "tests" or offering below-minimum scam compensation are removed.
  - *AR*: ممنوع نشر إعلانات تطلب شغل كامل تحت مسمى "تاسك تجريبي مجاني"؛ حق الفريلانسر خط أحمر.
  - *Action*: Job card removed + Scam Shield flag + 4 pts.

- **R22 [S2, Mode A] Demanding Free Work in Help Channels (طلب شغل مجاني في رومات المساعدة)**
  - *EN*: Technical help channels are for debugging and guidance, not for demanding free full-project coding.
  - *AR*: رومات المساعدة عشان تفهم وتصلح مشاكلك، مش عشان حد يعملك مشروعك كامل ببلاش.
  - *Action*: Message redirected to job board + Reminder + 2 pts.

- **R23 [S2, Mode A] Hostile Freelancer-Client Communications (التعامل العدائي وغير المهني في الصفقات)**
  - *EN*: Maintain professional standards in deal rooms. Insults, bad faith cancellations, and verbal abuse are penalized.
  - *AR*: اتعامل باحترافية في روم الصفقة؛ الشتيمة أو التهديد بإلغاء الصفقة باستهبال مرفوض.
  - *Action*: Tone coach warning + Deal dispute ladder escalation + 2 pts.

- **R24 [Care Exception, Mode C] Member Mental Health Crisis (دعم أزمات الصحة النفسية والتعب النفسي)**
  - *EN*: Expressions of severe distress, hopelessness, or self-harm receive IMMEDIATE compassionate crisis helpline resources. NO POINTS, NO PENALTIES.
  - *AR*: لو حد بيمر بأزمة نفسية أو بيكتب كلام فيه يأس وإيذاء نفس، بيتوفرله الدعم وأرقام المساعدة فوراً، وممنوع نهائياً تسجيل أي عقوبة أو نقاط عليه.
  - *Action*: Compassionate private outreach + Helpline numbers + Designated care moderator notified + 0 points.

- **R25 [S3, Mode S] Retaliatory Ratings & Whistleblower Abuse (التقييمات الانتقامية واضطهاد المبلّغين)**
  - *EN*: Retaliating against a member for honest dispute reports, negative escrow reviews, or whistleblowing is prohibited.
  - *AR*: ممنوع تنتقم من حد كتب تقييم صريح أو بلغ عن مشكلة؛ أي تقييم كيدي بيتم فحصه وإلغاؤه فوراً.
  - *Action*: Review frozen + Restorative justice mediation + 4 pts.

- **R26 [S2, Mode S] Non-Consensual Session Recording (تسجيل الجلسات بدون إذن الحاضرين)**
  - *EN*: Do not record voice rooms, pair programming, or workshops without explicit upfront consent from all participants.
  - *AR*: ممنوع تسجل كلام حد في الرومات الصوتية أو شير الشاشة إلا بموافقة كل اللي حاضرين.
  - *Action*: Warning + Recording share blocked + 2 pts.

- **R27 [S2, Mode S] Misrepresenting Deal Scope (التلاعب بنطاق الشغل ومواصفات التسليم)**
  - *EN*: Deliberately altering agreed requirements mid-deal without compensating scope adjustments is flagged for mediation.
  - *AR*: ممنوع تغيير مواصفات الشغل في نص الطريق بدون اتفاق واضح وتعديل للمبلغ المتفق عليه.
  - *Action*: Scope change manager triggered + Middleman mediation + 2 pts.

- **R28 [S2, Mode S] Refusing Dispute Ladder Process (رفض مسار حل النزاعات المتفق عليه)**
  - *EN*: Both parties in an escrow deal must engage constructively in the neutral mediation ladder.
  - *AR*: الطرفين في الصفقة ملزمين بالرد على الميدلمان وجلسات الوساطة لحل الخلاف بموضوعية.
  - *Action*: Escrow frozen + Case escalated to senior human moderator + 2 pts.

- **R29 [S3, Mode H] Academic Dishonesty & Fraudulent Services (حل امتحانات الجامعات والشهادات)**
  - *EN*: Do not hire or offer services for live cheating on university exams, certification tests, or thesis fabrication.
  - *AR*: ممنوع عروض أو طلبات حل امتحانات الكليات أو شهادات معتمدة؛ السيرفر لدعم التعلم الحقيقي فقط.
  - *Action*: Post deleted + Warning + 4 pts.

- **R30 [S3, Mode S] Unauthorized Piracy & Copyright Infringement (نشر كورسات وبرامج مسروقة)**
  - *EN*: Sharing pirated software, cracked license keys, or leaked commercial courses is not allowed.
  - *AR*: ممنوع نشر كراكات أو كورسات مدفوعة مسروقة؛ بنشجع الموارد المفتوحة والمجانية القانونية فقط.
  - *Action*: Content removed + Warning + 4 pts.

---

### Group 4: Community Culture, Inclusivity & Harmony (R31 - R40)
- **R31 [S1, Mode A] Off-Topic & Wrong Channel Usage (استخدام الرومات في غير تخصصها)**
  - *EN*: Post content in designated channels (e.g. keep code questions in `#tech-help`, jobs in `#jobs`).
  - *AR*: حط كل حاجة في مكانها المناسب (الأسئلة التقنية في روماتها، والوظائف في روم الوظائف).
  - *Action*: Auto-thread redirection + Friendly reminder + 1 pt.

- **R32 [S1, Mode A] Mass Pings & Unnecessary Mentions (المنشن العشوائي ومنشن الجميع)**
  - *EN*: Do not use `@everyone`, `@here`, or mass ping staff without valid emergency justification.
  - *AR*: بلاش منشن عمال على بطال للناس أو المشرفين؛ منشن لما تكون محتاج حاجة ضرورية فعلاً.
  - *Action*: Message filtered + Reminder + 1 pt.

- **R33 [S1, Mode A] Flame-Baiting & Bad-Faith Trolling (إشعال الخلافات والجدال العقيم)**
  - *EN*: Avoid provocative, bad-faith arguments designed only to annoy or provoke emotional outbursts.
  - *AR*: النقاش التقني البناء مطلوب، بس الجدال لمجرد العند واستفزاز الناس مرفوض.
  - *Action*: Slowmode applied + De-escalation prompt + 1 pt.

- **R34 [S2, Mode A] Divisive Political & Religious Debates (الخلافات السياسية والدينية الحادة)**
  - *EN*: Keep technical and professional spaces free from heated political or religious arguments.
  - *AR*: السيرفر مكان للشغل والتعلم؛ تجنب النقاشات السياسية أو الدينية اللي بتعمل حساسية وخلافات.
  - *Action*: Channel cool-down + Advisory reminder + 2 pts.

- **R35 [S1, Mode A] Violating Quiet Hours & Focus Rooms (إزعاج رومات التركيز وساعات الهدوء)**
  - *EN*: Respect quiet hours (22:00–06:00 UTC) and Pomodoro study rooms by minimizing loud alerts.
  - *AR*: احترم ساعات الهدوء ورومات التركيز (بومودورو)؛ حافظ على الهدوء عشان زمايلك شغالين.
  - *Action*: Mute in focus room + Reminder + 1 pt.

- **R36 [S2, Mode S] Fabricated Testimonials & Client Reviews (الفيدباك المفبرك والتقييمات المزيفة)**
  - *EN*: Do not create fake client accounts to leave glowing reviews on your own portfolio.
  - *AR*: ممنوع عمل حسابات فيك عشان تكتب لنفسك ريفيوهات ممتازة؛ التقييم لازم يكون من عميل حقيقي.
  - *Action*: Testimonial stripped + Review queue flag + 2 pts.

- **R37 [S2, Mode S] Collusion Rings for Kudos & Rep (شبكات تبادل النقاط واللايكات الوهمية)**
  - *EN*: Do not form circular groups that trade fake kudos, badges, or endorsements without real work.
  - *AR*: ممنوع تتفق مع أصحابك تدو بعض كودوز ونقاط سمعة بدون مساعدة أو شغل حقيقي.
  - *Action*: Collusion graph flag + Points rollback + 2 pts.

- **R38 [S3, Mode H] Scraping Member Directory & Lead Poaching (سحب بيانات الأعضاء والتواصل التطفلي)**
  - *EN*: Scraping server member lists or mass-DMing members with unsolicited job pitches is forbidden.
  - *AR*: ممنوع سحب داتا الأعضاء أو إرسال رسائل خاصة جماعية للترويج بدون إذن.
  - *Action*: API throttle + Protective hold + 4 pts.

- **R39 [S3, Mode H] Exploiting Bot Bugs & Economy Glitches (استغلال ثغرات البوت واقتصاد السيرفر)**
  - *EN*: If you find a bug in points, economy, or permissions, report it. Exploiting it leads to immediate action.
  - *AR*: لو لقيت ثغرة في البوت، بلغ عنها في سكات وخود شكر في لوحة الشرف؛ متستغلهاش.
  - *Action*: Economy rollback + Whistleblower invite + 4 pts.

- **R40 [S2, Mode A] Unsolicited Promotional DMs (الرسائل الإعلانية المزعجة في الخاص)**
  - *EN*: Do not send unsolicited promotional DMs to members you do not know.
  - *AR*: ممنوع دخول خاص لأعضاء متعرفهمش عشان تبعتلهم إعلانات لخدماتك أو قنواتك.
  - *Action*: Warning + DM-protection flag + 2 pts.

---

### Group 5: Advanced Safety, Governance & Equity (R41 - R50)
- **R41 [S4, Mode H] Youth Safety: Unmonitored Adult-Minor DMs (حماية القُصّر والتواصل الخاص)**
  - *EN*: Adults must not attempt private unmonitored communication with underage members. Mentorship is public.
  - *AR*: حماية صغار السن أولوية قصوى؛ ممنوع أي تواصل خاص مغلق من بالغين مع قُصّر؛ الإرشاد في الرومات العامة.
  - *Action*: Immediate containment hold + Safety coordinator notification.

- **R42 [S3, Mode H] Mentor Safeguarding & Power Abuse (استغلال سلطة الإرشاد والتعليم)**
  - *EN*: Mentors must uphold strict ethical standards. Exploiting mentees for free work or personal gain is barred.
  - *AR*: الإرشاد مسؤولية؛ ممنوع أي منتور يستغل المبتدئين عشان يشتغلو له مجاناً أو يضغط عليهم.
  - *Action*: Mentor badge revoked + Case review + 4 pts.

- **R43 [S1, Mode A] Disregarding Accessibility Accommodations (تجاهل متطلبات سهولة الوصول)**
  - *EN*: Provide alt-text on informational screenshots and respect requests for accessible formatting.
  - *AR*: ساعد زمايلك من ذوي الاحتياجات؛ اكتب وصف مختصر للصور المهمة ومتبخلش بتوضيح النص.
  - *Action*: Accessibility coach reminder + 1 pt.

- **R44 [S2, Mode A] Dialect & Accent Shaming (السخرية من اللهجات ومستوى اللغة)**
  - *EN*: Do not mock members for their Arabic dialect, English grammar, or communication style.
  - *AR*: ممنوع التريقة على لهجة أي عضو (مصري، خليجي، شامي، مغاربي) أو لغته الإنجليزية؛ التركيز على المحتوى التقني.
  - *Action*: Dialect protection warning + De-escalation + 2 pts.

- **R45 [S3, Mode S] Contest Voting Manipulation & Brigading (التلاعب بالتصويت والمسابقات)**
  - *EN*: Using bots, purchased votes, or outside brigades to skew community contest voting is prohibited.
  - *AR*: ممنوع شراء أصوات أو استخدام لجان إلكترونية عشان تكسب مسابقات السيرفر؛ الحكم للمهارة فقط.
  - *Action*: Contest votes disqualified + Plagiarism check flag + 4 pts.

- **R46 [S2, Mode S] Undisclosed AI Generation in Contests (استخدام ذكاء اصطناعي غير معلن بالمسابقات)**
  - *EN*: Disclose all AI assistance in competition submissions per the contest brief. Undisclosed generation is penalized.
  - *AR*: لو استخدمت ذكاء اصطناعي في تصميم أو كود بالمسابقة، لازم توضح دا بنزاهة حسب شروط المسابقة.
  - *Action*: Submission marked for transparency review + 2 pts.

- **R47 [S4, Mode H] Community Fund Embezzlement (التلاعب بأموال الصندوق والمنح)**
  - *EN*: Any misappropriation, false expense claim, or tampering with Community Fund resources results in immediate removal.
  - *AR*: أي تلاعب بأموال صندوق المجتمع أو تقديم فواتير مضروبة بينتج عنه عزل ومساءلة فورية.
  - *Action*: Fund lock + Dual-human administrative review + Whistleblower alert.

- **R48 [S2, Mode S] Malicious & Frivolous Reporting (البلاغات الكيدية وإساءة استخدام الشكاوى)**
  - *EN*: Submitting false moderation reports to harass an innocent peer is penalized.
  - *AR*: ممنوع تقديم شكاوى كيدية أو بلاغات مفبركة لتشويه سمعة زميلك.
  - *Action*: Report dismissed + Warning to submitter + 2 pts.

- **R49 [S4, Mode H] Administrative Threshold Bypass (محاولة تخطي الرقابة الثنائية والصلاحيات)**
  - *EN*: Attempting to bypass dual-signature requirements on payouts, rule amendments, or bans is strictly blocked.
  - *AR*: ممنوع محاولة تمرير أي سحب مالي أو تعديل ميثاق بدون التوقيع الثنائي الإداري المطلوب.
  - *Action*: Action blocked + Audit alert logged + Security review.

- **R50 [S2, Mode S] Open-Source License & Attribution Theft (سرقة تراخيص المصادر المفتوحة)**
  - *EN*: When reusing open-source community assets, respect licenses (MIT, AGPL, CC) and retain original attribution.
  - *AR*: احترم تراخيص الأكواد المفتوحة؛ متشلش اسم المؤلف الأصلي وحافظ على حقوق المصدر المفتوح.
  - *Action*: Attribution notice required + Asset vault warning + 2 pts.

---

## ⚖️ Decision Pipeline & Appeals

1. **Step 1: Detection & Context Check** (Quotes, reports, translation, code strings, or staff action do NOT trigger false positives).
2. **Step 2: Dialect & Cultural Filter** (Dialect vernacular like "يا لهوي", "تسليم على مية بيضا", "هندسة" are protected).
3. **Step 3: Care Check (R24)** (If distress or self-harm is identified, route to Mode C with 0 points).
4. **Step 4: Least Effective Action** (Mode A automated limits: delete, reminder, warning, max 1-hour timeout).
5. **Step 5: Logging & Notification** (Member receives plain-language bilingual explanation citing the Rule ID and `/appeal` link).
6. **Step 6: Appeals Process**:
   - Any member may run `/appeal case_id:<id> reason:<text>` within 7 calendar days.
   - S4 protective holds are reviewed immediately.
   - The appeal is reviewed by an **independent human moderator** different from the original decider.
   - Overturned cases erase points and feed the fairness monitor.
