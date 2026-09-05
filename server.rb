require 'webrick'

root = File.expand_path(__dir__)
port = 8000

server = WEBrick::HTTPServer.new(Port: port, DocumentRoot: root)
trap('INT') { server.shutdown }

puts "AETHER is running → http://localhost:#{port}"
server.start
