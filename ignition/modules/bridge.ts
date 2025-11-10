import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("Bridge", (m) => {
    const bridge = m.contract("Bridge", []);

    return { bridge };
});