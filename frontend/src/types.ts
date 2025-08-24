export type Step = 1 | 2;

export type MqttCreds = {
  host: string;
  port: number;
  username: string;
  password: string;
};

export type TopicRow = {
  id: string;
  kind: keyof typeof KIND_LABEL;
  topic: string;
};

export const KIND_LABEL = {
  t_sonda: "temperatura sonda",
  t_amb: "temperatura ambiente",
  h_amb: "humedad ambiente",
  gases: "medición de gases",
} as const;
// --- MQTT subscribe (agregar al final) ---
export type SubscribeReq = MqttCreds & {
  topics: string[];
  qos?: 0 | 1 | 2;
  probe?: boolean;
  timeout_ms?: number;
};

export type SubscribeResp = {
  ok: boolean;
  granted: Record<string, number>; // 0|1|2 ó 128 si el broker rechazó (ACL)
  probe_ok?: boolean | null;
};

