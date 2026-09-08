import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_DATA_FILE = path.join(__dirname, '../../data/elder_data.json');

class DatabaseService {
  constructor() {
    this.mode = 'local'; // 'supabase' | 'postgres' | 'local'
    this.supabase = null;
    this.pool = null;
    this.localData = {
      elder_points: {},
      blacklist: {},
      tickets: {},
      modmail: {},
      config: {}
    };
  }

  async init() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.mode = 'supabase';
      console.log(`[DATABASE] Connecting to Supabase Client: ${supabaseUrl}`);
      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('[DATABASE] Supabase client initialized.');
      return;
    }

    if (process.env.DATABASE_URL) {
      this.mode = 'postgres';
      console.log('[DATABASE] Connecting to PostgreSQL via DATABASE_URL...');
      this.pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
      });

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS elder_points (
          user_id VARCHAR(64) PRIMARY KEY,
          username VARCHAR(128),
          points BIGINT DEFAULT 0,
          last_daily TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS blacklist (
          target_id VARCHAR(64) PRIMARY KEY,
          target_tag VARCHAR(128),
          reason TEXT,
          proof TEXT,
          added_by VARCHAR(128),
          added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS tickets (
          channel_id VARCHAR(64) PRIMARY KEY,
          ticket_id VARCHAR(64),
          user_id VARCHAR(64),
          status VARCHAR(32) DEFAULT 'open',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          closed_at TIMESTAMP,
          closed_by VARCHAR(128)
        );
        CREATE TABLE IF NOT EXISTS modmail (
          user_id VARCHAR(64) PRIMARY KEY,
          thread_id VARCHAR(64),
          status VARCHAR(32) DEFAULT 'open',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[DATABASE] PostgreSQL tables ready.');
      return;
    }

    this.mode = 'local';
    console.log('[DATABASE] Using local persistent JSON database at data/elder_data.json');
    if (fs.existsSync(LOCAL_DATA_FILE)) {
      try {
        const raw = fs.readFileSync(LOCAL_DATA_FILE, 'utf-8');
        this.localData = { ...this.localData, ...JSON.parse(raw) };
      } catch (e) {
        console.error('[DATABASE] Error reading local data file, starting fresh:', e.message);
      }
    } else {
      this.saveLocalData();
    }
  }

  saveLocalData() {
    if (this.mode !== 'local') return;
    try {
      const dir = path.dirname(LOCAL_DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(this.localData, null, 2), 'utf-8');
    } catch (e) {
      console.error('[DATABASE] Error saving local data:', e.message);
    }
  }

  // ==========================================
  // 1. ELDER POINTS (CURRENCY)
  // ==========================================
  async getPoints(userId) {
    if (this.mode === 'supabase') {
      const { data, error } = await this.supabase
        .from('elder_points')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[SUPABASE] getPoints error:', error.message);
        return null;
      }
      return data ? { ...data, points: Number(data.points) } : null;
    }

    if (this.mode === 'postgres') {
      const res = await this.pool.query('SELECT * FROM elder_points WHERE user_id = $1', [userId]);
      return res.rows[0] ? { ...res.rows[0], points: parseInt(res.rows[0].points, 10) } : null;
    }

    return this.localData.elder_points[userId] || null;
  }

  async addPoints(userId, username, amount) {
    if (this.mode === 'supabase') {
      const current = await this.getPoints(userId);
      const newPoints = (current ? current.points : 0) + amount;

      const { data, error } = await this.supabase
        .from('elder_points')
        .upsert({
          user_id: userId,
          username,
          points: newPoints
        })
        .select()
        .single();

      if (error) {
        console.error('[SUPABASE] addPoints error:', error.message);
        throw error;
      }
      return { ...data, points: Number(data.points) };
    }

    if (this.mode === 'postgres') {
      const res = await this.pool.query(
        `INSERT INTO elder_points (user_id, username, points)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id)
         DO UPDATE SET points = elder_points.points + $3, username = $2
         RETURNING *`,
        [userId, username, amount]
      );
      return { ...res.rows[0], points: parseInt(res.rows[0].points, 10) };
    }

    if (!this.localData.elder_points[userId]) {
      this.localData.elder_points[userId] = { userId, username, points: 0, lastDaily: null };
    }
    this.localData.elder_points[userId].username = username;
    this.localData.elder_points[userId].points += amount;
    this.saveLocalData();
    return this.localData.elder_points[userId];
  }

  async claimDaily(userId, username, rewardAmount = 100) {
    const now = new Date();
    const cooldownHours = 24;

    if (this.mode === 'supabase') {
      const current = await this.getPoints(userId);

      if (current && current.last_daily) {
        const lastDaily = new Date(current.last_daily);
        const diffHours = (now.getTime() - lastDaily.getTime()) / (1000 * 60 * 60);
        if (diffHours < cooldownHours) {
          const remainingMs = cooldownHours * 60 * 60 * 1000 - (now.getTime() - lastDaily.getTime());
          return { success: false, remainingMs };
        }
      }

      const newPoints = (current ? current.points : 0) + rewardAmount;
      const { data, error } = await this.supabase
        .from('elder_points')
        .upsert({
          user_id: userId,
          username,
          points: newPoints,
          last_daily: now.toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('[SUPABASE] claimDaily error:', error.message);
        throw error;
      }
      return { success: true, points: Number(data.points), rewardAmount };
    }

    if (this.mode === 'postgres') {
      const userRes = await this.pool.query('SELECT * FROM elder_points WHERE user_id = $1', [userId]);
      const user = userRes.rows[0];

      if (user && user.last_daily) {
        const lastDaily = new Date(user.last_daily);
        const diffHours = (now.getTime() - lastDaily.getTime()) / (1000 * 60 * 60);
        if (diffHours < cooldownHours) {
          const remainingMs = cooldownHours * 60 * 60 * 1000 - (now.getTime() - lastDaily.getTime());
          return { success: false, remainingMs };
        }
      }

      const updated = await this.pool.query(
        `INSERT INTO elder_points (user_id, username, points, last_daily)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id)
         DO UPDATE SET points = elder_points.points + $3, username = $2, last_daily = $4
         RETURNING *`,
        [userId, username, rewardAmount, now]
      );
      return { success: true, points: parseInt(updated.rows[0].points, 10), rewardAmount };
    }

    const user = this.localData.elder_points[userId];
    if (user && user.lastDaily) {
      const lastDaily = new Date(user.lastDaily);
      const diffHours = (now.getTime() - lastDaily.getTime()) / (1000 * 60 * 60);
      if (diffHours < cooldownHours) {
        const remainingMs = cooldownHours * 60 * 60 * 1000 - (now.getTime() - lastDaily.getTime());
        return { success: false, remainingMs };
      }
    }

    if (!this.localData.elder_points[userId]) {
      this.localData.elder_points[userId] = { userId, username, points: 0, lastDaily: null };
    }
    this.localData.elder_points[userId].username = username;
    this.localData.elder_points[userId].points += rewardAmount;
    this.localData.elder_points[userId].lastDaily = now.toISOString();
    this.saveLocalData();
    return { success: true, points: this.localData.elder_points[userId].points, rewardAmount };
  }

  async getLeaderboard(limit = 10) {
    if (this.mode === 'supabase') {
      const { data, error } = await this.supabase
        .from('elder_points')
        .select('user_id, username, points')
        .order('points', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[SUPABASE] getLeaderboard error:', error.message);
        return [];
      }
      return (data || []).map(r => ({ ...r, points: Number(r.points) }));
    }

    if (this.mode === 'postgres') {
      const res = await this.pool.query(
        'SELECT user_id, username, points FROM elder_points ORDER BY points DESC LIMIT $1',
        [limit]
      );
      return res.rows.map(r => ({ ...r, points: parseInt(r.points, 10) }));
    }

    const all = Object.values(this.localData.elder_points);
    all.sort((a, b) => b.points - a.points);
    return all.slice(0, limit);
  }

  // ==========================================
  // 2. BLACKLIST SYSTEM
  // ==========================================
  async addBlacklist(targetId, targetTag, reason, proof, addedBy) {
    const entry = {
      targetId,
      targetTag,
      reason,
      proof: proof || 'None provided',
      addedBy,
      addedAt: new Date().toISOString()
    };

    if (this.mode === 'supabase') {
      const { error } = await this.supabase
        .from('blacklist')
        .upsert({
          target_id: targetId,
          target_tag: targetTag,
          reason,
          proof: proof || 'None provided',
          added_by: addedBy,
          added_at: new Date().toISOString()
        });

      if (error) {
        console.error('[SUPABASE] addBlacklist error:', error.message);
        throw error;
      }
      return entry;
    }

    if (this.mode === 'postgres') {
      await this.pool.query(
        `INSERT INTO blacklist (target_id, target_tag, reason, proof, added_by, added_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (target_id)
         DO UPDATE SET target_tag = $2, reason = $3, proof = $4, added_by = $5, added_at = $6`,
        [targetId, targetTag, reason, proof || 'None provided', addedBy, new Date()]
      );
      return entry;
    }

    this.localData.blacklist[targetId] = entry;
    this.saveLocalData();
    return entry;
  }

  async getBlacklist(targetId) {
    if (this.mode === 'supabase') {
      const { data, error } = await this.supabase
        .from('blacklist')
        .select('*')
        .eq('target_id', targetId)
        .maybeSingle();

      if (error) {
        console.error('[SUPABASE] getBlacklist error:', error.message);
        return null;
      }
      if (data) {
        return {
          targetId: data.target_id,
          targetTag: data.target_tag,
          reason: data.reason,
          proof: data.proof,
          addedBy: data.added_by,
          addedAt: data.added_at
        };
      }
      return null;
    }

    if (this.mode === 'postgres') {
      const res = await this.pool.query('SELECT * FROM blacklist WHERE target_id = $1', [targetId]);
      if (res.rows[0]) {
        const r = res.rows[0];
        return {
          targetId: r.target_id,
          targetTag: r.target_tag,
          reason: r.reason,
          proof: r.proof,
          addedBy: r.added_by,
          addedAt: r.added_at
        };
      }
      return null;
    }

    return this.localData.blacklist[targetId] || null;
  }

  async removeBlacklist(targetId) {
    if (this.mode === 'supabase') {
      const { data, error } = await this.supabase
        .from('blacklist')
        .delete()
        .eq('target_id', targetId)
        .select();

      if (error) {
        console.error('[SUPABASE] removeBlacklist error:', error.message);
        return false;
      }
      return data && data.length > 0;
    }

    if (this.mode === 'postgres') {
      const res = await this.pool.query('DELETE FROM blacklist WHERE target_id = $1 RETURNING *', [targetId]);
      return res.rowCount > 0;
    }

    if (this.localData.blacklist[targetId]) {
      delete this.localData.blacklist[targetId];
      this.saveLocalData();
      return true;
    }
    return false;
  }

  async getAllBlacklist() {
    if (this.mode === 'supabase') {
      const { data, error } = await this.supabase
        .from('blacklist')
        .select('*')
        .order('added_at', { ascending: false });

      if (error) {
        console.error('[SUPABASE] getAllBlacklist error:', error.message);
        return [];
      }
      return (data || []).map(d => ({
        targetId: d.target_id,
        targetTag: d.target_tag,
        reason: d.reason,
        proof: d.proof,
        addedBy: d.added_by,
        addedAt: d.added_at
      }));
    }

    if (this.mode === 'postgres') {
      const res = await this.pool.query('SELECT * FROM blacklist ORDER BY added_at DESC');
      return res.rows.map(r => ({
        targetId: r.target_id,
        targetTag: r.target_tag,
        reason: r.reason,
        proof: r.proof,
        addedBy: r.added_by,
        addedAt: r.added_at
      }));
    }

    return Object.values(this.localData.blacklist);
  }

  // ==========================================
  // 3. TICKETS
  // ==========================================
  async createTicket(channelId, ticketId, userId) {
    const entry = {
      channelId,
      ticketId,
      userId,
      status: 'open',
      createdAt: new Date().toISOString(),
      closedAt: null,
      closedBy: null
    };

    if (this.mode === 'supabase') {
      await this.supabase.from('tickets').insert({
        channel_id: channelId,
        ticket_id: ticketId,
        user_id: userId,
        status: 'open',
        created_at: new Date().toISOString()
      });
      return entry;
    }

    if (this.mode === 'postgres') {
      await this.pool.query(
        `INSERT INTO tickets (channel_id, ticket_id, user_id, status)
         VALUES ($1, $2, $3, 'open')`,
        [channelId, ticketId, userId]
      );
      return entry;
    }

    this.localData.tickets[channelId] = entry;
    this.saveLocalData();
    return entry;
  }

  async getTicket(channelId) {
    if (this.mode === 'supabase') {
      const { data } = await this.supabase
        .from('tickets')
        .select('*')
        .eq('channel_id', channelId)
        .maybeSingle();

      if (data) {
        return {
          channelId: data.channel_id,
          ticketId: data.ticket_id,
          userId: data.user_id,
          status: data.status,
          createdAt: data.created_at,
          closedAt: data.closed_at,
          closedBy: data.closed_by
        };
      }
      return null;
    }

    if (this.mode === 'postgres') {
      const res = await this.pool.query('SELECT * FROM tickets WHERE channel_id = $1', [channelId]);
      if (res.rows[0]) {
        const r = res.rows[0];
        return {
          channelId: r.channel_id,
          ticketId: r.ticket_id,
          userId: r.user_id,
          status: r.status,
          createdAt: r.created_at,
          closedAt: r.closed_at,
          closedBy: r.closed_by
        };
      }
      return null;
    }

    return this.localData.tickets[channelId] || null;
  }

  async closeTicket(channelId, closedBy) {
    const now = new Date().toISOString();
    if (this.mode === 'supabase') {
      await this.supabase.from('tickets').update({
        status: 'closed',
        closed_at: now,
        closed_by: closedBy
      }).eq('channel_id', channelId);
      return;
    }

    if (this.mode === 'postgres') {
      await this.pool.query(
        `UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP, closed_by = $2
         WHERE channel_id = $1`,
        [channelId, closedBy]
      );
      return;
    }

    if (this.localData.tickets[channelId]) {
      this.localData.tickets[channelId].status = 'closed';
      this.localData.tickets[channelId].closedAt = now;
      this.localData.tickets[channelId].closedBy = closedBy;
      this.saveLocalData();
    }
  }

  // ==========================================
  // 4. MODMAIL
  // ==========================================
  async getModmail(userId) {
    if (this.mode === 'supabase') {
      const { data } = await this.supabase
        .from('modmail')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'open')
        .maybeSingle();

      if (data) {
        return {
          userId: data.user_id,
          threadId: data.thread_id,
          status: data.status,
          createdAt: data.created_at
        };
      }
      return null;
    }

    if (this.mode === 'postgres') {
      const res = await this.pool.query('SELECT * FROM modmail WHERE user_id = $1 AND status = $2', [userId, 'open']);
      if (res.rows[0]) {
        return {
          userId: res.rows[0].user_id,
          threadId: res.rows[0].thread_id,
          status: res.rows[0].status,
          createdAt: res.rows[0].created_at
        };
      }
      return null;
    }

    const mm = this.localData.modmail[userId];
    return mm && mm.status === 'open' ? mm : null;
  }

  async setModmail(userId, threadId) {
    const entry = {
      userId,
      threadId,
      status: 'open',
      createdAt: new Date().toISOString()
    };

    if (this.mode === 'supabase') {
      await this.supabase.from('modmail').upsert({
        user_id: userId,
        thread_id: threadId,
        status: 'open',
        created_at: new Date().toISOString()
      });
      return entry;
    }

    if (this.mode === 'postgres') {
      await this.pool.query(
        `INSERT INTO modmail (user_id, thread_id, status)
         VALUES ($1, $2, 'open')
         ON CONFLICT (user_id)
         DO UPDATE SET thread_id = $2, status = 'open'`,
        [userId, threadId]
      );
      return entry;
    }

    this.localData.modmail[userId] = entry;
    this.saveLocalData();
    return entry;
  }

  async closeModmail(userId) {
    if (this.mode === 'supabase') {
      await this.supabase.from('modmail').update({ status: 'closed' }).eq('user_id', userId);
      return;
    }

    if (this.mode === 'postgres') {
      await this.pool.query('UPDATE modmail SET status = $1 WHERE user_id = $2', ['closed', userId]);
      return;
    }

    if (this.localData.modmail[userId]) {
      this.localData.modmail[userId].status = 'closed';
      this.saveLocalData();
    }
  }
}

export const db = new DatabaseService();
