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
      ticket_config: {},
      config: {}
    };
  }

  async init() {
    // Always load local data for fallback
    if (fs.existsSync(LOCAL_DATA_FILE)) {
      try {
        const raw = fs.readFileSync(LOCAL_DATA_FILE, 'utf-8');
        this.localData = { ...this.localData, ...JSON.parse(raw) };
      } catch (e) {
        console.error('[DATABASE] Error reading local data file:', e.message);
      }
    } else {
      this.saveLocalData();
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.mode = 'supabase';
      console.log(`[DATABASE] Connecting to Supabase Client: ${supabaseUrl}`);
      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('[DATABASE] Supabase client initialized with local fallback shield.');
      return;
    }

    if (process.env.DATABASE_URL) {
      this.mode = 'postgres';
      console.log('[DATABASE] Connecting to PostgreSQL via DATABASE_URL...');
      this.pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
      });
      console.log('[DATABASE] PostgreSQL pool initialized.');
      return;
    }

    this.mode = 'local';
    console.log('[DATABASE] Using local persistent JSON database at data/elder_data.json');
  }

  saveLocalData() {
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
      try {
        const { data, error } = await this.supabase
          .from('elder_points')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          if (error.code === 'PGRST205') {
            // Table doesn't exist yet, fallback
            return this.localData.elder_points[userId] || null;
          }
          console.warn('[SUPABASE getPoints error, using local fallback]:', error.message);
          return this.localData.elder_points[userId] || null;
        }
        return data ? { ...data, points: Number(data.points) } : null;
      } catch (err) {
        return this.localData.elder_points[userId] || null;
      }
    }

    if (this.mode === 'postgres') {
      try {
        const res = await this.pool.query('SELECT * FROM elder_points WHERE user_id = $1', [userId]);
        return res.rows[0] ? { ...res.rows[0], points: parseInt(res.rows[0].points, 10) } : null;
      } catch (err) {
        return this.localData.elder_points[userId] || null;
      }
    }

    return this.localData.elder_points[userId] || null;
  }

  async addPoints(userId, username, amount) {
    // Always update local cache as fallback
    if (!this.localData.elder_points[userId]) {
      this.localData.elder_points[userId] = { userId, username, points: 0, lastDaily: null };
    }
    this.localData.elder_points[userId].username = username;
    this.localData.elder_points[userId].points += amount;
    this.saveLocalData();

    if (this.mode === 'supabase') {
      try {
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
          console.warn('[SUPABASE addPoints fallback to local]:', error.message);
          return this.localData.elder_points[userId];
        }
        return { ...data, points: Number(data.points) };
      } catch (err) {
        console.warn('[SUPABASE addPoints exception, using local]:', err.message);
        return this.localData.elder_points[userId];
      }
    }

    if (this.mode === 'postgres') {
      try {
        const res = await this.pool.query(
          `INSERT INTO elder_points (user_id, username, points)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id)
           DO UPDATE SET points = elder_points.points + $3, username = $2
           RETURNING *`,
          [userId, username, amount]
        );
        return { ...res.rows[0], points: parseInt(res.rows[0].points, 10) };
      } catch (err) {
        return this.localData.elder_points[userId];
      }
    }

    return this.localData.elder_points[userId];
  }

  async claimDaily(userId, username, rewardAmount = 100) {
    const now = new Date();
    const cooldownHours = 24;

    const currentLocal = this.localData.elder_points[userId];
    if (currentLocal && currentLocal.lastDaily) {
      const lastDaily = new Date(currentLocal.lastDaily);
      const diffHours = (now.getTime() - lastDaily.getTime()) / (1000 * 60 * 60);
      if (diffHours < cooldownHours) {
        const remainingMs = cooldownHours * 60 * 60 * 1000 - (now.getTime() - lastDaily.getTime());
        return { success: false, remainingMs };
      }
    }

    if (this.mode === 'supabase') {
      try {
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
          console.warn('[SUPABASE claimDaily fallback to local]:', error.message);
          return this.claimDailyLocal(userId, username, rewardAmount, now);
        }

        // Sync local cache
        this.claimDailyLocal(userId, username, rewardAmount, now);
        return { success: true, points: Number(data.points), rewardAmount };
      } catch (err) {
        return this.claimDailyLocal(userId, username, rewardAmount, now);
      }
    }

    return this.claimDailyLocal(userId, username, rewardAmount, now);
  }

  claimDailyLocal(userId, username, rewardAmount, now) {
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
      try {
        const { data, error } = await this.supabase
          .from('elder_points')
          .select('user_id, username, points')
          .order('points', { ascending: false })
          .limit(limit);

        if (!error && data && data.length > 0) {
          return data.map(r => ({ ...r, points: Number(r.points) }));
        }
      } catch (err) {
        // fallback to local
      }
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

    // Always update local
    this.localData.blacklist[targetId] = entry;
    this.saveLocalData();

    if (this.mode === 'supabase') {
      try {
        const { error } = await this.supabase
          .from('blacklist')
          .upsert({
            target_id: targetId,
            target_tag: targetTag,
            reason,
            proof: proof || 'None provided',
            added_by: addedBy,
            added_at: entry.addedAt
          });

        if (error) {
          console.warn('[SUPABASE addBlacklist fallback to local]:', error.message);
        }
      } catch (err) {
        console.warn('[SUPABASE addBlacklist exception]:', err.message);
      }
    }

    return entry;
  }

  async getBlacklist(targetId) {
    if (this.mode === 'supabase') {
      try {
        const { data, error } = await this.supabase
          .from('blacklist')
          .select('*')
          .eq('target_id', targetId)
          .maybeSingle();

        if (!error && data) {
          return {
            targetId: data.target_id,
            targetTag: data.target_tag,
            reason: data.reason,
            proof: data.proof,
            addedBy: data.added_by,
            addedAt: data.added_at
          };
        }
      } catch (err) {
        // fallback
      }
    }

    return this.localData.blacklist[targetId] || null;
  }

  async removeBlacklist(targetId) {
    let removed = false;
    if (this.localData.blacklist[targetId]) {
      delete this.localData.blacklist[targetId];
      this.saveLocalData();
      removed = true;
    }

    if (this.mode === 'supabase') {
      try {
        const { data, error } = await this.supabase
          .from('blacklist')
          .delete()
          .eq('target_id', targetId)
          .select();

        if (!error && data && data.length > 0) removed = true;
      } catch (err) {
        // ignore
      }
    }

    return removed;
  }

  async getAllBlacklist() {
    if (this.mode === 'supabase') {
      try {
        const { data, error } = await this.supabase
          .from('blacklist')
          .select('*')
          .order('added_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map(d => ({
            targetId: d.target_id,
            targetTag: d.target_tag,
            reason: d.reason,
            proof: d.proof,
            addedBy: d.added_by,
            addedAt: d.added_at
          }));
        }
      } catch (err) {
        // fallback
      }
    }

    return Object.values(this.localData.blacklist);
  }

  // ==========================================
  // 3. TICKET CONFIGURATION (TICKET TOOL STYLE)
  // ==========================================
  async getTicketConfig(guildId) {
    const defaultConfig = {
      guildId,
      categoryId: null,
      categoryName: null,
      supportRoles: [], // array of role IDs
      loggingChannelId: null,
      panelChannelId: null,
      panelTitle: '📩 Elder Clan Applications & Support',
      panelDescription: 'Need assistance, have questions, or want to apply for the **Elder Clan**?\n\nClick the button below to open a private ticket with our staff!',
      panelColor: '#5865f2',
      buttonText: 'Open Ticket',
      buttonEmoji: '📩',
      ticketMessage: 'Hello {user}! Welcome to your support ticket.\nPlease state your request or application details. Our support team will assist you shortly.'
    };

    if (this.mode === 'supabase') {
      try {
        const { data, error } = await this.supabase
          .from('ticket_config')
          .select('config')
          .eq('guild_id', guildId)
          .maybeSingle();

        if (!error && data && data.config) {
          return { ...defaultConfig, ...data.config };
        }
      } catch (err) {
        // fallback
      }
    }

    return this.localData.ticket_config[guildId] || defaultConfig;
  }

  async setTicketConfig(guildId, config) {
    this.localData.ticket_config[guildId] = {
      ...(this.localData.ticket_config[guildId] || {}),
      ...config,
      guildId
    };
    this.saveLocalData();

    if (this.mode === 'supabase') {
      try {
        await this.supabase
          .from('ticket_config')
          .upsert({
            guild_id: guildId,
            config: this.localData.ticket_config[guildId]
          });
      } catch (err) {
        console.warn('[SUPABASE setTicketConfig exception]:', err.message);
      }
    }

    return this.localData.ticket_config[guildId];
  }

  // ==========================================
  // 4. TICKETS
  // ==========================================
  async createTicket(channelId, ticketId, userId, categoryId = null) {
    const entry = {
      channelId,
      ticketId,
      userId,
      categoryId,
      status: 'open',
      claimedBy: null,
      createdAt: new Date().toISOString(),
      closedAt: null,
      closedBy: null
    };

    this.localData.tickets[channelId] = entry;
    this.saveLocalData();

    if (this.mode === 'supabase') {
      try {
        await this.supabase.from('tickets').insert({
          channel_id: channelId,
          ticket_id: ticketId,
          user_id: userId,
          status: 'open',
          created_at: entry.createdAt
        });
      } catch (err) {
        // fallback
      }
    }

    return entry;
  }

  async getTicket(channelId) {
    if (this.mode === 'supabase') {
      try {
        const { data, error } = await this.supabase
          .from('tickets')
          .select('*')
          .eq('channel_id', channelId)
          .maybeSingle();

        if (!error && data) {
          return {
            channelId: data.channel_id,
            ticketId: data.ticket_id,
            userId: data.user_id,
            status: data.status,
            claimedBy: data.claimed_by || null,
            createdAt: data.created_at,
            closedAt: data.closed_at,
            closedBy: data.closed_by
          };
        }
      } catch (err) {
        // fallback
      }
    }

    return this.localData.tickets[channelId] || null;
  }

  async claimTicket(channelId, claimedBy) {
    if (this.localData.tickets[channelId]) {
      this.localData.tickets[channelId].claimedBy = claimedBy;
      this.saveLocalData();
    }
  }

  async closeTicket(channelId, closedBy) {
    const now = new Date().toISOString();
    if (this.localData.tickets[channelId]) {
      this.localData.tickets[channelId].status = 'closed';
      this.localData.tickets[channelId].closedAt = now;
      this.localData.tickets[channelId].closedBy = closedBy;
      this.saveLocalData();
    }

    if (this.mode === 'supabase') {
      try {
        await this.supabase.from('tickets').update({
          status: 'closed',
          closed_at: now,
          closed_by: closedBy
        }).eq('channel_id', channelId);
      } catch (err) {
        // fallback
      }
    }
  }

  // ==========================================
  // 5. MODMAIL
  // ==========================================
  async getModmail(userId) {
    if (this.mode === 'supabase') {
      try {
        const { data, error } = await this.supabase
          .from('modmail')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'open')
          .maybeSingle();

        if (!error && data) {
          return {
            userId: data.user_id,
            threadId: data.thread_id,
            status: data.status,
            createdAt: data.created_at
          };
        }
      } catch (err) {
        // fallback
      }
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

    this.localData.modmail[userId] = entry;
    this.saveLocalData();

    if (this.mode === 'supabase') {
      try {
        await this.supabase.from('modmail').upsert({
          user_id: userId,
          thread_id: threadId,
          status: 'open',
          created_at: entry.createdAt
        });
      } catch (err) {
        // fallback
      }
    }

    return entry;
  }

  async closeModmail(userId) {
    if (this.localData.modmail[userId]) {
      this.localData.modmail[userId].status = 'closed';
      this.saveLocalData();
    }

    if (this.mode === 'supabase') {
      try {
        await this.supabase.from('modmail').update({ status: 'closed' }).eq('user_id', userId);
      } catch (err) {
        // fallback
      }
    }
  }
}

export const db = new DatabaseService();
