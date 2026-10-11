// GENERATED FILE — do not edit by hand.
// Produced by scripts/sync-abi.mjs from out/GhostSprint.sol/GhostSprint.json.
// Re-run `forge build && npm run sync:abi` after changing src/GhostSprint.sol.

export const ghostSprintAbi = [
  {
    "type": "function",
    "name": "MAX_INPUT_LENGTH",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "TICK_RATE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "bestRunId",
    "inputs": [
      {
        "name": "player",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "bestTime",
    "inputs": [
      {
        "name": "player",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "computeTimeMs",
    "inputs": [
      {
        "name": "ticks",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "getRun",
    "inputs": [
      {
        "name": "runId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct GhostSprint.Run",
        "components": [
          {
            "name": "player",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "tick",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "timeMs",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "submittedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "inputLength",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "inputsHash",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRunInputs",
    "inputs": [
      {
        "name": "runId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRunInputsChunk",
    "inputs": [
      {
        "name": "runId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "len",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "chunk",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRunInputsLength",
    "inputs": [
      {
        "name": "runId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRuns",
    "inputs": [
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "page",
        "type": "tuple[]",
        "internalType": "struct GhostSprint.RunView[]",
        "components": [
          {
            "name": "runId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "player",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "tick",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "timeMs",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "submittedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "inputLength",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "inputsHash",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "levelId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "playerRunCount",
    "inputs": [
      {
        "name": "player",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "runCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "submitRun",
    "inputs": [
      {
        "name": "inputs",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "runId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "version",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "event",
    "name": "PersonalBestImproved",
    "inputs": [
      {
        "name": "player",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "runId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "previousTimeMs",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "newTimeMs",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RunVerified",
    "inputs": [
      {
        "name": "runId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "player",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "tick",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "timeMs",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "inputLength",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "inputs",
        "type": "bytes",
        "indexed": false,
        "internalType": "bytes"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ChunkOutOfBounds",
    "inputs": [
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "EmptyInputLog",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EmptyInputLog",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InputLogTooLong",
    "inputs": [
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "maxLength",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InputLogTooLong",
    "inputs": [
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "maxLength",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidInputByte",
    "inputs": [
      {
        "name": "tick",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "inputByte",
        "type": "uint8",
        "internalType": "uint8"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidInputByte",
    "inputs": [
      {
        "name": "tick",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "inputByte",
        "type": "uint8",
        "internalType": "uint8"
      }
    ]
  },
  {
    "type": "error",
    "name": "RunNotVerified",
    "inputs": [
      {
        "name": "status",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "ticks",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "UnknownRun",
    "inputs": [
      {
        "name": "runId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  }
] as const;

export type GhostSprintAbi = typeof ghostSprintAbi;
