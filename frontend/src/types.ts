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
