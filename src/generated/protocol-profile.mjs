// Generated from protocol/profile.v1.json. Run npm run generate:protocol-profile.
const profile = {
  confidential: {
    aad_bytes: 4096,
    chunk_plaintext_bytes: 65536,
    counter_max_exclusive: "4294967296",
    epoch_max: "18446744073709551615",
    manifest_bytes: 131072,
    max_chunks: 64,
    max_custodians: 16,
    package_bytes: 4194304,
    reservation_count_max: "64",
    resource_bytes: 3098890,
    rsa_wrapped_bytes: 384
  },
  continuity: {
    copy_envelope_bytes: 11188908,
    signed_copy_count: 3,
    signed_copy_quorum: 2
  },
  format: "mortalos-protocol-profile/1",
  provider: {
    object_bytes: 8388608,
    objects_per_room: 512
  },
  state: {
    chunk_bytes: 65536,
    input_bytes: 4096,
    manifest_bytes: 32768,
    max_chunks: 64,
    receipt_bytes: 4096,
    reference_resource_bytes: 1048576,
    resource_bytes: 4194304
  },
  transport: {
    data_fragment_bytes: 32768,
    frame_bytes: 98304,
    message_bytes: 65536,
    range_limit: 128,
    room_bytes: 8388608,
    room_messages: 512
  }
};

function deepFreeze(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") deepFreeze(child);
  }
  return Object.freeze(value);
}

export const PROTOCOL_PROFILE = deepFreeze(profile);
