import { canonicalBytes } from "../../src/codec.mjs";
import {
  createRelayControlMessage,
  createRelayMessage,
  decodeRelayFrame
} from "../../src/transport/protocol.mjs";
import { LiveEndpointParticipant } from "./live-endpoint.mjs";
import { ManualWebRtcParticipantTransport } from "../transport/webrtc-peer.mjs";

const ROLES = new Set(["A", "B"]);
const ENDPOINT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;

function relayRecordBytes(record) {
  return canonicalBytes(createRelayMessage(record));
}

function relayControlBytes(kind, content) {
  return canonicalBytes(createRelayControlMessage(kind, content));
}

function clone(value) {
  return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
}

export class DirectParticipantSession {
  #error = null;
  #genesis = null;
  #inbound = Promise.resolve();
  #joinRequest = null;
  #participant = null;
  #proposal = null;
  #role;
  #stage = "idle";
  #transport = null;
  #unsubscribe = null;

  constructor({ endpointId, role }) {
    if (!ROLES.has(role)) throw new TypeError("direct participant role must be A or B");
    if (typeof endpointId !== "string" || !ENDPOINT_ID.test(endpointId)) {
      throw new TypeError("direct participant endpoint ID is invalid");
    }
    this.#role = role;
    this.endpointId = endpointId;
  }

  get snapshot() {
    return Object.freeze({
      endpoint_id: this.endpointId,
      error: this.#error,
      participant: clone(this.#participant?.publicState ?? null),
      remote_endpoint_id: this.#transport?.remoteEndpointId ?? null,
      role: this.#role,
      stage: this.#stage,
      transport: this.#transport?.state ?? "none"
    });
  }

  async startOffer() {
    if (this.#role !== "A" || this.#stage !== "idle") throw new Error("only idle A may create an offer");
    this.#participant = new LiveEndpointParticipant(this.endpointId);
    this.#genesis = await this.#participant.create();
    const created = await ManualWebRtcParticipantTransport.createOffer({ endpointId: this.endpointId });
    this.#bindTransport(created.transport);
    this.#stage = "offer-ready";
    return created.signal;
  }

  async acceptOffer(offer) {
    if (this.#role !== "B" || this.#stage !== "idle") throw new Error("only idle B may accept an offer");
    const accepted = await ManualWebRtcParticipantTransport.acceptOffer({
      endpointId: this.endpointId,
      offer
    });
    this.#bindTransport(accepted.transport);
    this.#stage = "answer-ready";
    return accepted.signal;
  }

  async completeAnswer(answer) {
    if (this.#role !== "A" || this.#stage !== "offer-ready") {
      throw new Error("only offer-ready A may complete an answer");
    }
    await this.#transport.complete(answer);
    await this.#transport.ready();
    this.#stage = "connected";
    await this.#transport.publish(relayRecordBytes(this.#genesis));
    this.#stage = "genesis-sent";
  }

  async waitUntilConnected() {
    if (!this.#transport) throw new Error("direct transport is not initialized");
    await this.#transport.ready();
    return this.snapshot;
  }

  async retireOrigin() {
    if (this.#role !== "A" || this.#stage !== "handoff") {
      throw new Error("origin can retire only after handoff");
    }
    this.#participant.removeAuthority();
    this.#unsubscribe?.();
    this.#transport.close();
    this.#stage = "origin-retired";
    return this.snapshot;
  }

  async continueLocally() {
    if (this.#role !== "B" || this.#stage !== "handoff") {
      throw new Error("successor can continue only after handoff");
    }
    await this.#participant.nurture();
    this.#stage = "continued";
    return this.snapshot;
  }

  close() {
    this.#unsubscribe?.();
    this.#transport?.close();
  }

  #bindTransport(transport) {
    this.#transport = transport;
    this.#unsubscribe = transport.subscribe((frame) => {
      this.#inbound = this.#inbound
        .then(() => this.#observe(frame))
        .catch((error) => {
          this.#error = error instanceof Error ? `${error.code ?? "DIRECT_SESSION"}: ${error.message}` : String(error);
          this.#stage = "failed";
        });
      return this.#inbound;
    });
  }

  async #observe(frame) {
    const opened = decodeRelayFrame(frame);
    if (this.#role === "B" && opened.record?.envelope?.kind === "mortalos.genesis") {
      if (this.#participant) throw new Error("duplicate Genesis received");
      this.#participant = new LiveEndpointParticipant(this.endpointId);
      this.#joinRequest = await this.#participant.join(opened.record);
      await this.#transport.publish(relayControlBytes("join-request", this.#joinRequest));
      this.#stage = "join-sent";
      return;
    }
    if (this.#role === "A" && opened.control?.kind === "join-request") {
      if (opened.control.content.organism_id !== this.#participant?.publicState.organism_id) {
        throw new Error("join request organism mismatch");
      }
      this.#proposal = await this.#participant.proposeHandoff(opened.control.content);
      await this.#transport.publish(relayControlBytes("handoff-proposal", this.#proposal));
      this.#stage = "proposal-sent";
      return;
    }
    if (this.#role === "B" && opened.control?.kind === "handoff-proposal") {
      const evidence = await this.#participant.acceptHandoff(opened.control.content);
      await this.#transport.publish(relayRecordBytes(evidence));
      this.#stage = "handoff";
      return;
    }
    if (
      this.#role === "A" &&
      opened.record?.envelope?.kind === "mortalos.pulse" &&
      opened.record.envelope.body.event.kind === "membership-change"
    ) {
      this.#participant.appendEvidence(opened.record);
      this.#stage = "handoff";
    }
  }
}
