// commands/join.js - Auto Join Group
module.exports = {
    name: 'join',
    category: 'Group',
    description: 'Bot joins a group via invite link',
    ownerOnly: true,
    run: async (sock, msg, { args }) => {
        const senderJid = msg.key.remoteJid;
        
        if (!args[0]) {
            await sock.sendMessage(senderJid, {
                text: `📱 *Usage:* .join <group_link>\n\n*Example:*\n.join https://chat.whatsapp.com/xxxxxxx`
            });
            return;
        }
        
        const inviteLink = args[0];
        
        // Extract the invite code from the link
        let inviteCode = '';
        if (inviteLink.includes('chat.whatsapp.com/')) {
            inviteCode = inviteLink.split('chat.whatsapp.com/')[1];
            // Remove any query parameters
            inviteCode = inviteCode.split('?')[0];
        } else {
            await sock.sendMessage(senderJid, {
                text: '❌ Invalid group link! Please provide a valid WhatsApp group invite link.'
            });
            return;
        }
        
        try {
            await sock.sendMessage(senderJid, {
                text: '⏳ Joining group...'
            });
            
            // Accept the invite and join the group
            const result = await sock.groupAcceptInvite(inviteCode);
            
            if (result) {
                const groupId = result.id;
                const groupName = result.subject || 'Unknown Group';
                
                console.log(`✅ Joined group: ${groupName} (${groupId})`);
                
                await sock.sendMessage(senderJid, {
                    text: `✅ Successfully joined group!\n\n📊 *Group Info:*\n📛 Name: ${groupName}\n🆔 ID: ${groupId}\n\nUse *.menu* to see available commands!`
                });
                
                // Send welcome message to the group
                await sock.sendMessage(groupId, {
                    text: `👋 Hello *${groupName}*!\n\n🤖 I'm *ADEZ MD* - your WhatsApp assistant!\n\n📱 Use *.menu* to see all my commands!\n\nPowered by *ADEZ TECH*`
                });
            } else {
                await sock.sendMessage(senderJid, {
                    text: '❌ Failed to join group. The link might be invalid or expired.'
                });
            }
        } catch (error) {
            console.error('❌ Error joining group:', error.message);
            
            // Handle specific errors
            if (error.message.includes('401')) {
                await sock.sendMessage(senderJid, {
                    text: '❌ Cannot join group - the bot might be banned or blocked from joining.'
                });
            } else if (error.message.includes('403')) {
                await sock.sendMessage(senderJid, {
                    text: '❌ Cannot join group - this might be a private group or the bot is not allowed.'
                });
            } else if (error.message.includes('400')) {
                await sock.sendMessage(senderJid, {
                    text: '❌ Invalid invite link. Please check the URL and try again.'
                });
            } else {
                await sock.sendMessage(senderJid, {
                    text: `❌ Failed to join group. Error: ${error.message}`
                });
            }
        }
    }
};
