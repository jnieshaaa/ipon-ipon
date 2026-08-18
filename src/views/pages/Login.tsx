import React from "react";
import { AuthController } from "../../controllers/AuthController";

const auth = new AuthController();

export default function Login() {
  const handleLogin = () => {
    const user = auth.login({
      email: "test@test.com",
      password: "123"
    });

    console.log(user);
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Login</h1>
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}
