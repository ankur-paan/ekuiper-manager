'use client';

import React from 'react';

const KNOWN_CONNECTOR_ICONS: Record<string, string> = {
  can: '/icons/connectors/can.svg',
  ekuiper: '/icons/connectors/ekuiper.svg',
  file: '/icons/connectors/file.svg',
  httppull: '/icons/connectors/httppull.svg',
  httppush: '/icons/connectors/httppush.svg',
  image: '/icons/connectors/image.svg',
  influx: '/icons/connectors/influx.svg',
  influx2: '/icons/connectors/influx2.svg',
  json: '/icons/connectors/json.svg',
  kafka: '/icons/connectors/kafka.svg',
  log: '/icons/connectors/log.svg',
  memory: '/icons/connectors/memory.svg',
  modbus: '/icons/connectors/modbus.svg',
  mqtt: '/icons/connectors/mqtt.svg',
  neuron: '/icons/connectors/neuron.svg',
  nop: '/icons/connectors/nop.svg',
  redis: '/icons/connectors/redis.svg',
  redispub: '/icons/connectors/redis.svg',
  redissub: '/icons/connectors/redis.svg',
  rest: '/icons/connectors/rest.svg',
  simulator: '/icons/connectors/simulator.svg',
  sql: '/icons/connectors/sql.svg',
  video: '/icons/connectors/video.svg',
  websocket: '/icons/connectors/websocket.svg',
};

/**
 * Returns the public icon path for a given connector type, or null if no SVG exists.
 */
export function getConnectorIconUrl(type?: string): string | null {
  if (!type) return null;
  return KNOWN_CONNECTOR_ICONS[type.toLowerCase().trim()] || null;
}

/**
 * Renders a crisp vector SVG icon for a connector type with fallback support.
 */
export function ConnectorIcon({
  type,
  className = 'h-4 w-4',
  fallback,
}: {
  type?: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const iconUrl = getConnectorIconUrl(type);
  if (!iconUrl) return fallback ? <>{fallback}</> : null;

  return (
    <img
      src={iconUrl}
      alt={type || 'Connector'}
      className={`inline-block object-contain shrink-0 ${className}`}
      loading="lazy"
    />
  );
}
