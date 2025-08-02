app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Attendance');
    const idx = headers.indexOf('رقم الموظف');
    const code = normalizeDigits(String(req.user.code).trim());
    // صفوف الموظف
    const userRows = data.filter(r => normalizeDigits((r[idx] || '').trim()) === code);
    // صفوف عامة
    const generalRows = data.filter(r => !(r[idx] || '').toString().trim());
    // ملاحظة عامة لجميع العاملين
    const noteAllCol = headers.indexOf('تنبيهات وملاحظات عامة لجميع العاملين');
    const generalNoteAll = generalRows[0]?.[noteAllCol]?.trim() || '';
    // ملاحظة عامة عمومية (من عمود منفصل إن وجد)
    const noteCol = headers.indexOf('تنبيهات وملاحظات عامة');
    const generalNote = noteCol !== -1 ? (generalRows.map(r=>r[noteCol].trim()).filter(n=>n)[0] || '') : '';
    return res.json({ headers, data: userRows, generalNoteAll, generalNote });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/hwafez', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('hwafez');
    const idx = headers.indexOf('رقم الموظف');
    const code = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r => normalizeDigits((r[idx] || '').trim()) === code);
    return res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/tqeem', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('tqeem');
    const idx = headers.indexOf('رقم الموظف');
    const code = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r => normalizeDigits((r[idx] || '').trim()) === code);
    return res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/register-token', authenticate, (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) return res.status(400).json({ error: 'user and token required' });
  tokens.set(token, user);
  return res.json({ success: true });
});

app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) return res.status(403).json({ error: 'Forbidden' });
  const { title, body } = req.body;
  await Promise.allSettled(
    Array.from(tokens.keys()).map(t => sendPushTo(t, title, body))
  );
  return res.json({ success: true });
});

// سجل إشعارات المستخدم (ذاكرة)
const userNotifications = {};
app.post('/api/notifications', authenticate, (req, res) => {
  const { title, body, time } = req.body;
  if (!title || !body || !time) return res.status(400).json({ error: 'Missing fields' });
  const code = req.user.code;
  userNotifications[code] = userNotifications[code] || [];
  userNotifications[code].unshift({ title, body, time });
  if (userNotifications[code].length > 50) userNotifications[code].pop();
  return res.json({ success: true });
});
app.get('/api/notifications', authenticate, (req, res) => {
  return res.json({ notifications: userNotifications[req.user.code] || [] });
});

app.get('/api/version', (_, res) => res.json({ version: APP_VERSION }));
app.get(/.*/, (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

app.listen(PORT, () => console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`));
