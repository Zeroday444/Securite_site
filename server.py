from livereload import Server

server = Server()
server.watch('.')

server.serve(port=8000, host='127.0.0.1', open_url_delay=1)