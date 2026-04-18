import React, { useMemo } from 'react';
import { Calendar, Badge, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { ITEMS } from '../../constants';

// Blend a hex color 45% toward light gray — keeps hue but reads as "past/muted"
function muteColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = c => Math.round(c * 0.45 + 180 * 0.55).toString(16).padStart(2, '0');
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}

function parseApptDate(message) {
  if (!message) return null;
  const m = message.match(/(?:\w+\s+)?(\w+\s+\d{1,2},?\s*\d{4})/i);
  if (!m) return null;
  const d = dayjs(m[1]);
  return d.isValid() ? d.format('YYYY-MM-DD') : null;
}

// Extract first time slot from either raw or processed message format
function parseFirstTime(message) {
  if (!message) return null;
  const m = message.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/i);
  return m ? m[0].toUpperCase() : null;
}

export default function AppointmentCalendar({ events, status }) {
  const today = dayjs().startOf('day');

  const histMap = useMemo(() => {
    const map = {};
    for (const e of events) {
      const key = parseApptDate(e.message);
      if (!key) continue;
      (map[key] = map[key] || []).push(e);
    }
    return map;
  }, [events]);

  const currentMap = useMemo(() => {
    if (!status?.state) return {};
    const map = {};
    for (const [name, st] of Object.entries(status.state)) {
      if (st.lastStatus !== 'yes') continue;
      const key = parseApptDate(st.lastMessage);
      if (!key) continue;
      const item = ITEMS.find(i => name.toLowerCase().includes(i.key));
      (map[key] = map[key] || []).push({
        name,
        label:   item?.label || 'APT',
        color:   item?.color || '#1677ff',
        message: st.lastMessage,
      });
    }
    return map;
  }, [status]);

  const defaultValue = useMemo(() => {
    const keys = Object.keys(currentMap).sort();
    return keys.length ? dayjs(keys[0]) : dayjs();
  }, [currentMap]);

  function cellRender(current, info) {
    if (info.type !== 'date') return info.originNode;
    const key = current.format('YYYY-MM-DD');
    const isPast = current.isBefore(today);
    const curr = currentMap[key] || [];
    const hist = (histMap[key] || []).filter(
      e => !curr.some(c => c.name.toLowerCase().includes(e.item.toLowerCase().includes('cpl') ? 'cpl' : 'afl'))
    );
    if (!curr.length && !hist.length) return null;

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {curr.map((c, i) => {
          const time = parseFirstTime(c.message);
          return (
            <li key={`c${i}`}>
              <Tooltip title={c.message}>
                <Badge
                  color={c.color}
                  text={
                    <span style={{ fontSize: 10, textDecoration: isPast ? 'line-through' : 'none' }}>
                      {c.label}{time ? ` ${time}` : ''}
                    </span>
                  }
                />
              </Tooltip>
            </li>
          );
        })}
        {hist.map((e, i) => {
          const item = ITEMS.find(it => e.item.toLowerCase().includes(it.key));
          const color = muteColor(item?.color || '#888888');
          const time = parseFirstTime(e.message);
          return (
            <li key={`h${i}`}>
              <Tooltip title={`Released ${dayjs(e.timestamp).format('MMM D [at] h:mm A')}: ${e.message}`}>
                <Badge
                  color={color}
                  text={
                    <span style={{ fontSize: 10, color, textDecoration: 'line-through' }}>
                      {item?.label || 'APT'}{time ? ` ${time}` : ''}
                    </span>
                  }
                />
              </Tooltip>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Calendar
      cellRender={cellRender}
      defaultValue={defaultValue}
    />
  );
}
