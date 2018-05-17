package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var clients = make(map[*websocket.Conn]string)
var broadcast = make(chan Message)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Message struct {
	Action   string   `json:"action"`
	Username string   `json:"username"`
	Message  string   `json:"message"`
	Users    []string `json:"users"`
	Channel	string `json:"channel"`
	Time	int `json:"time"`
}

func main() {
	// Create a simple file server
	fs := http.FileServer(http.Dir("public"))
	http.Handle("/", fs)

	http.HandleFunc("/ws", handleConnections)

	go handleMessages()

	log.Println("http server started on :8000")
	err := http.ListenAndServe(":8000", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Fatal(err)
	}

	defer ws.Close()

	for {
		var msg Message
		err := ws.ReadJSON(&msg)
		if err != nil {
			log.Printf("error: %v", err)

			msg.Action = "offline"
			msg.Username = clients[ws]
			broadcast <- msg

			delete(clients, ws)
			break
		}

		if msg.Action == "register" || msg.Action == "login" {
			clients[ws] = msg.Username
			fmt.Println("Register user : ", msg.Username)

			for _, username := range clients {
				msg.Users = append(msg.Users, username)
			}
		}else if msg.Action == "logout" {
			delete(clients, ws)
			broadcast <- msg

			ws.Close()
			return
		}

		if msg.Channel != "" && msg.Channel != "broadcast"{
			ws.WriteJSON(msg)
		}

		broadcast <- msg
	}
}

func handleMessages() {
	for {
		msg := <-broadcast
		for client, username := range clients {
			fmt.Println("Send -> ", username)
			fmt.Println(msg)
			if msg.Channel != "" && msg.Channel != "broadcast" {
				if msg.Channel == username {
					temp := msg
					temp.Channel = temp.Username
					err := client.WriteJSON(temp)
					if err != nil {
						log.Printf("error: %v", err)
						client.Close()
						delete(clients, client)
					}
				}
			}else{
				err := client.WriteJSON(msg)
				if err != nil {
					log.Printf("error: %v", err)
					client.Close()
					delete(clients, client)
				}
			}
		}
	}
}