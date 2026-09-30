// Senior Progg Dashboard Client Logic

const i18n = {
  ar: {
    ownerPortal: 'لوحة المالك',
    overview: 'نظرة عامة',
    members: 'الأعضاء والتحقق',
    escrow: 'الوساطة والإسكرو',
    aiBrain: 'عقل الذكاء الاصطناعي',
    liveStream: 'البث الحي للأحداث',
    overviewTitle: 'لوحة التحكم المركزية للسيرفر',
    overviewSub: 'متابعة فورية لنشاط المجتمع، الاقتصاد، وعمليات الوساطة',
    kpiTotalMembers: 'إجمالي الأعضاء',
    kpiCirculatingCredits: 'الرصيد المتداول',
    kpiActiveEscrows: 'صفقات الإسكرو النشطة',
    kpiHealthScore: 'مؤشر صحة المجتمع',
    aiRecommendations: 'توصيات وملاحظات الذكاء الاصطناعي الأسبوعية',
    membersManagement: 'إدارة الأعضاء والتحقق من الخبرة',
    searchPlaceholder: 'بحث بالاسم أو المعرف...',
    colUser: 'المستخدم',
    colRole: 'الرتبة',
    colCredits: 'الرصيد',
    colReputation: 'السمعة',
    colStage: 'المرحلة',
    colStatus: 'الحالة',
    colActions: 'الإجراءات',
    escrowDealsTitle: 'صفقات الوساطة وحل النزاعات',
    colDealId: 'رقم الصفقة',
    colTitle: 'العنوان',
    colAmount: 'المبلغ',
    aiBrainConfig: 'إعدادات عقل الذكاء الاصطناعي (Senior Progg AI Brain)',
    providerLabel: 'المزود النشط (Primary Provider):',
    temperatureLabel: 'درجة الإبداع (Temperature):',
    slangLabel: 'كثافة اللهجة المصرية التقنية (Egyptian Slang Intensity):',
    saveConfig: 'حفظ وتطبيق الإعدادات',
    aiPlayground: 'منصة اختبار الردود الحية (AI Playground)',
    testGenerate: 'اختبار التوليد الفوري 🚀',
    liveEventFeed: 'شريط الأحداث الحية (Real-time SSE Event Feed)',
    btnFreeze: 'تجميد',
    btnUnfreeze: 'إلغاء التجميد',
    btnRelease: 'تحرير فوري',
    activeLabel: 'نشط',
    restrictedLabel: 'مقيد / لارب',
  },
  en: {
    ownerPortal: 'Owner Portal',
    overview: 'Overview',
    members: 'Members & Vetting',
    escrow: 'Escrow & Middlemen',
    aiBrain: 'Central AI Brain',
    liveStream: 'Live Event Stream',
    overviewTitle: 'Server Command Center',
    overviewSub: 'Real-time telemetry on community growth, economy, and escrow brokerage',
    kpiTotalMembers: 'Total Members',
    kpiCirculatingCredits: 'Circulating Credits',
    kpiActiveEscrows: 'Active Escrow Deals',
    kpiHealthScore: 'Community Health Index',
    aiRecommendations: 'Weekly AI Brain Recommendations',
    membersManagement: 'Member Management & Seniority Vetting',
    searchPlaceholder: 'Search by username or ID...',
    colUser: 'User',
    colRole: 'Seniority',
    colCredits: 'Credits',
    colReputation: 'Reputation',
    colStage: 'Stage',
    colStatus: 'Status',
    colActions: 'Actions',
    escrowDealsTitle: 'Escrow Brokerage & Dispute Resolution',
    colDealId: 'Deal ID',
    colTitle: 'Title',
    colAmount: 'Amount',
    aiBrainConfig: 'Central AI Brain Configuration',
    providerLabel: 'Active AI Provider:',
    temperatureLabel: 'Creativity / Temperature:',
    slangLabel: 'Egyptian Tech Slang Intensity:',
    saveConfig: 'Save Configuration',
    aiPlayground: 'Live AI Persona Playground',
    testGenerate: 'Test Prompt 🚀',
    liveEventFeed: 'Real-time SSE Event Feed',
    btnFreeze: 'Freeze',
    btnUnfreeze: 'Unfreeze',
    btnRelease: 'Override Release',
    activeLabel: 'Active',
    restrictedLabel: 'Restricted / Larper',
  }
};

let currentLang = 'ar';

// Get token from URL or cookie
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('token');
const authToken = tokenFromUrl || 'progg_admin_secret_token_2026';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${authToken}`
};

// DOM Elements
const htmlRoot = document.getElementById('htmlRoot');
const langToggleBtn = document.getElementById('langToggleBtn');
const langLabel = document.getElementById('langLabel');

// Navigation Tabs
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));

    btn.classList.add('active');
    const tabName = btn.dataset.tab;
    const targetSection = document.getElementById(`view-${tabName}`);
    if (targetSection) targetSection.classList.add('active');

    if (tabName === 'members') loadMembers();
    if (tabName === 'escrow') loadEscrows();
    if (tabName === 'ai') loadAiConfig();
  });
});

// Language Toggle
langToggleBtn.addEventListener('click', () => {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  htmlRoot.setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');
  htmlRoot.setAttribute('lang', currentLang);
  langLabel.textContent = currentLang === 'ar' ? 'English' : 'العربية';
  applyTranslations();
});

function applyTranslations() {
  const t = i18n[currentLang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) el.setAttribute('placeholder', t[key]);
  });
}

// Fetch Stats & KPI
async function loadStats() {
  try {
    const res = await fetch('/api/stats', { headers });
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('kpiMembers').textContent = data.members.total;
    document.getElementById('kpiActiveRatio').textContent = `${data.members.active7d} ${currentLang === 'ar' ? 'نشط هذا الأسبوع' : 'active this week'}`;
    document.getElementById('kpiCredits').textContent = data.economy.totalCreditsInCirculation.toLocaleString();
    document.getElementById('kpiTransactions').textContent = `${data.economy.totalLedgerTransactions} ${currentLang === 'ar' ? 'عملية مسجلة' : 'ledger entries'}`;
    document.getElementById('kpiEscrows').textContent = data.escrow.activeDeals;
    document.getElementById('kpiDisputes').textContent = `${data.escrow.openDisputes} ${currentLang === 'ar' ? 'نزاعات مفتوحة' : 'open disputes'}`;
    document.getElementById('kpiHealth').textContent = `${data.communityHealth.overallScore}/100`;
    document.getElementById('kpiHealthGrade').textContent = `${data.communityHealth.grade} (${currentLang === 'ar' ? 'تقييم عام' : 'overall rating'})`;

    const recList = document.getElementById('recommendationsList');
    recList.innerHTML = '';
    data.communityHealth.recommendations.forEach(rec => {
      const li = document.createElement('li');
      li.textContent = `• ${rec}`;
      recList.appendChild(li);
    });
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Fetch Members
async function loadMembers(search = '') {
  try {
    const url = `/api/members?q=${encodeURIComponent(search)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return;
    const data = await res.json();

    const tbody = document.getElementById('membersTableBody');
    tbody.innerHTML = '';

    if (data.members.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center">${currentLang === 'ar' ? 'لا توجد نتائج' : 'No members found'}</td></tr>`;
      return;
    }

    data.members.forEach(m => {
      const tr = document.createElement('tr');
      const isRestricted = m.is_restricted === 1;
      const statusBadge = isRestricted
        ? `<span class="event-badge badge-warning">${i18n[currentLang].restrictedLabel}</span>`
        : `<span class="event-badge badge-success">${i18n[currentLang].activeLabel}</span>`;

      tr.innerHTML = `
        <td><strong>${m.username}</strong><br><small style="color:var(--text-muted)">${m.user_id}</small></td>
        <td>${m.seniority_level}</td>
        <td>🪙 ${m.credits}</td>
        <td>⭐ ${m.reputation_score}</td>
        <td>${m.lifecycle_stage}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn-secondary" style="width:auto;padding:4px 8px;font-size:0.8rem" onclick="toggleFreeze('${m.user_id}', ${!isRestricted})">
            ${isRestricted ? i18n[currentLang].btnUnfreeze : i18n[currentLang].btnFreeze}
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load members:', err);
  }
}

window.toggleFreeze = async function(userId, freeze) {
  try {
    await fetch(`/api/members/${userId}/freeze`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ freeze })
    });
    loadMembers(document.getElementById('memberSearchInput').value);
  } catch (err) {
    alert('Failed to update freeze status');
  }
};

document.getElementById('memberSearchInput').addEventListener('input', (e) => {
  loadMembers(e.target.value);
});

// Fetch Escrows
async function loadEscrows() {
  try {
    const res = await fetch('/api/escrows', { headers });
    if (!res.ok) return;
    const data = await res.json();

    const tbody = document.getElementById('dealsTableBody');
    tbody.innerHTML = '';

    if (data.deals.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">${currentLang === 'ar' ? 'لا توجد صفقات حالية' : 'No active deals'}</td></tr>`;
      return;
    }

    data.deals.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>${d.id}</code></td>
        <td>${d.title}</td>
        <td>$${d.total_amount}</td>
        <td><span class="event-badge badge-info">${d.status}</span></td>
        <td>
          ${d.status !== 'completed' ? `
            <button class="btn-primary" style="padding:4px 10px;font-size:0.8rem" onclick="overrideRelease('${d.id}')">
              ${i18n[currentLang].btnRelease}
            </button>
          ` : '—'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load escrows:', err);
  }
}

window.overrideRelease = async function(dealId) {
  if (!confirm('Are you sure you want to trigger emergency owner release for this deal?')) return;
  try {
    await fetch(`/api/escrows/${dealId}/override-release`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ recipient: 'freelancer', reason: 'Owner dashboard emergency release' })
    });
    loadEscrows();
    loadStats();
  } catch (err) {
    alert('Failed to execute release');
  }
};

// AI Brain Configuration
async function loadAiConfig() {
  try {
    const res = await fetch('/api/ai/config', { headers });
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('aiProviderSelect').value = data.config.primaryProvider;
    document.getElementById('aiTempSlider').value = data.config.temperature;
    document.getElementById('tempVal').textContent = data.config.temperature;
    document.getElementById('aiSlangSlider').value = data.config.toneIntensity;
    document.getElementById('slangVal').textContent = `${Math.round(data.config.toneIntensity * 100)}%`;
  } catch (err) {
    console.error('Failed to load AI config:', err);
  }
}

document.getElementById('aiTempSlider').addEventListener('input', (e) => {
  document.getElementById('tempVal').textContent = e.target.value;
});

document.getElementById('aiSlangSlider').addEventListener('input', (e) => {
  document.getElementById('slangVal').textContent = `${Math.round(e.target.value * 100)}%`;
});

document.getElementById('saveAiConfigBtn').addEventListener('click', async () => {
  const primaryProvider = document.getElementById('aiProviderSelect').value;
  const temperature = parseFloat(document.getElementById('aiTempSlider').value);
  const toneIntensity = parseFloat(document.getElementById('aiSlangSlider').value);

  try {
    await fetch('/api/ai/config', {
      method: 'POST',
      headers,
      body: JSON.stringify({ primaryProvider, temperature, toneIntensity })
    });
    alert(currentLang === 'ar' ? 'تم حفظ إعدادات الذكاء الاصطناعي بنجاح!' : 'AI settings saved successfully!');
  } catch (err) {
    alert('Failed to save settings');
  }
});

// AI Test Prompt
document.getElementById('sendAiTestBtn').addEventListener('click', async () => {
  const prompt = document.getElementById('aiPromptInput').value;
  if (!prompt.trim()) return;

  const box = document.getElementById('aiResponseBox');
  box.innerHTML = `<p style="color:var(--text-muted)">Thinking / جاري التوليد والتحليل...</p>`;

  try {
    const res = await fetch('/api/ai/test-prompt', {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt, lang: currentLang })
    });
    const data = await res.json();
    box.innerHTML = `
      <p style="white-space:pre-wrap;margin-bottom:8px"><strong>Senior Progg:</strong> ${data.response}</p>
      <small style="color:var(--accent)">Provider: ${data.providerUsed} | Tone: ${data.explainability.tone} | Confidence: ${data.explainability.confidence}</small>
    `;
  } catch (err) {
    box.innerHTML = `<p style="color:var(--danger)">Error generating response</p>`;
  }
});

// Real-time Event Feed via SSE
function initSSE() {
  const eventSource = new EventSource('/api/events');
  const list = document.getElementById('liveEventsList');

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'connected') return;

      const item = document.createElement('div');
      item.className = 'event-item';
      item.innerHTML = `
        <span class="event-time">${new Date(data.timestamp).toLocaleTimeString()}</span>
        <span class="event-badge badge-info">${data.type}</span>
        <span class="event-msg">${JSON.stringify(data.data)}</span>
      `;
      list.prepend(item);
    } catch (e) {
      console.error('SSE parse error:', e);
    }
  };
}

// Initial Load
applyTranslations();
loadStats();
initSSE();
