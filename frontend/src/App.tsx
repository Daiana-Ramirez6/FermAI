import React, { useState } from "react";
import FormMosquitto from "./components/FormMosquitto";
import { MqttCreds, TopicRow } from "./types";
import LiveView from "./components/LiveView"; 

export default function App() {
  const [step, setStep] = useState<1 | 2>(1);
  const isLive = new URLSearchParams(window.location.search).get("live") === "1";
  if (isLive) return <LiveView />;

  function handleConnected(creds: MqttCreds, topics: TopicRow[]) {
    console.log("Conectado con", creds, "y topics", topics);
  }

  return (
    <div className="center">
      {/* 👇 en la pantalla 1 usamos card + welcome */}
      <div className={`card ${step === 1 ? "welcome" : ""}`}>
        {step === 1 ? (
          <section>
            <h1 className="h1-celeste">Bienvenido a FermAI</h1>
            <div className="btn-row">
              <button className="btn-primary" onClick={() => setStep(2)}>
                siguiente
              </button>
            </div>
          </section>
        ) : (
          <FormMosquitto onConnected={handleConnected} />
        )}
      </div>
    </div>
  );
}

