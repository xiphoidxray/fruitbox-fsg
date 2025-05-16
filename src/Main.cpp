#include <App.h>
#include <iostream>

struct UserData {};                       // nothing special needed

int main() {
    /* Create the app and attach one WebSocket route that matches any path */
    uWS::App()
        .ws<UserData>("/*", {
            /* Called for every text or binary frame we receive */
            .message = [](auto *ws, std::string_view msg, uWS::OpCode op) {
                ws->send(msg, op);        // ⇦ echo right back
            }
        })
        .listen(9001, [](auto *token) {
            if (token)
                std::cout << "Echo server listening on ws://localhost:9001/\n";
            else
                std::cerr << "❌  Failed to bind to port 9001\n";
        })
        .run();

    return 0;
}
