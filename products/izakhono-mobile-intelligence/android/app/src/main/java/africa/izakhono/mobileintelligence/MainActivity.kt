package africa.izakhono.mobileintelligence

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Forest = Color(0xFF103D32)
private val Gold = Color(0xFFD6B65B)
private val Canvas = Color(0xFFF4F6F3)
private val Ink = Color(0xFF17251F)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { IzakhonoApp() }
    }
}

@Composable
fun IzakhonoApp() {
    var selected by remember { mutableStateOf("Home") }
    MaterialTheme(colorScheme = lightColorScheme(primary = Forest, secondary = Gold, background = Canvas)) {
        Scaffold(
            containerColor = Canvas,
            bottomBar = {
                NavigationBar(containerColor = Color.White) {
                    listOf("Home", "Privacy", "Automate", "Social").forEach { item ->
                        NavigationBarItem(
                            selected = selected == item,
                            onClick = { selected = item },
                            icon = { Text(when(item) { "Home" -> "⌂"; "Privacy" -> "◈"; "Automate" -> "↗"; else -> "◎" }, fontSize = 20.sp) },
                            label = { Text(item) }
                        )
                    }
                }
            }
        ) { padding ->
            when(selected) {
                "Home" -> HomeScreen(Modifier.padding(padding), onSelect = { selected = it })
                "Privacy" -> PrivacyScreen(Modifier.padding(padding))
                "Automate" -> AutomationScreen(Modifier.padding(padding))
                else -> SocialScreen(Modifier.padding(padding))
            }
        }
    }
}

@Composable
fun Page(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.fillMaxSize().background(Canvas).padding(horizontal = 20.dp, vertical = 18.dp), content = content)
}

@Composable
fun BrandHeader() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text("IZAKHONO", color = Forest, fontSize = 13.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
            Text("MOBILE INTELLIGENCE", color = Ink, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
        }
        Box(Modifier.size(42.dp).background(Forest, RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
            Text("I", color = Gold, fontSize = 25.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
fun HomeScreen(modifier: Modifier = Modifier, onSelect: (String) -> Unit) {
    Page(modifier) {
        BrandHeader()
        Spacer(Modifier.height(26.dp))
        Text("Your digital life,", color = Ink, fontSize = 27.sp, fontWeight = FontWeight.Bold)
        Text("under your control.", color = Forest, fontSize = 27.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text("Privacy, intelligent automation and business insight in one place.", color = Color(0xFF617168), fontSize = 14.sp)
        Spacer(Modifier.height(22.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MetricCard("SECURITY", "Protected", "Privacy overview", Modifier.weight(1f))
            MetricCard("AUTOMATIONS", "0 active", "Your workflows", Modifier.weight(1f))
        }
        Spacer(Modifier.height(12.dp))
        Text("YOUR SERVICES", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF617168), letterSpacing = 1.5.sp)
        Spacer(Modifier.height(10.dp))
        ModuleCard("Privacy Centre", "Understand permissions and strengthen account security", "◈") { onSelect("Privacy") }
        ModuleCard("Automation Studio", "Create routines, reminders and business workflows", "↗") { onSelect("Automate") }
        ModuleCard("Social Intelligence", "Monitor authorised accounts and brand activity", "◎") { onSelect("Social") }
        Spacer(Modifier.weight(1f))
        Text("PREVIEW BUILD · SERVICES NOT CONNECTED", color = Color(0xFF7B827E), fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
    }
}

@Composable
fun MetricCard(label: String, value: String, caption: String, modifier: Modifier = Modifier) {
    Column(modifier.background(Forest, RoundedCornerShape(18.dp)).padding(16.dp)) {
        Text(label, color = Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        Spacer(Modifier.height(10.dp))
        Text(value, color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Bold)
        Text(caption, color = Color(0xFFD3DFD8), fontSize = 11.sp)
    }
}

@Composable
fun ModuleCard(title: String, detail: String, symbol: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp).background(Color.White, RoundedCornerShape(16.dp)).clickable(onClick = onClick).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(44.dp).background(Color(0xFFE8F0EB), RoundedCornerShape(13.dp)), contentAlignment = Alignment.Center) {
            Text(symbol, color = Forest, fontSize = 23.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.width(13.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = Ink, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Text(detail, color = Color(0xFF69766F), fontSize = 11.sp, lineHeight = 15.sp)
        }
        Text("›", color = Forest, fontSize = 27.sp)
    }
}

@Composable
fun PrivacyScreen(modifier: Modifier = Modifier) {
    Page(modifier) {
        BrandHeader()
        Spacer(Modifier.height(25.dp))
        Text("Privacy Centre", color = Ink, fontSize = 26.sp, fontWeight = FontWeight.Bold)
        Text("Visibility and control for your digital security.", color = Color(0xFF617168))
        Spacer(Modifier.height(20.dp))
        InfoCard("App permissions", "This preview does not yet read device permissions. The Android permission integration will request access transparently.")
        InfoCard("Account protection", "Session verification and multi-factor authentication are planned for the connected service.")
        InfoCard("Security checks", "Link and account risk checks will be connected after the API and threat-intelligence services pass testing.")
        InfoCard("Your consent", "Permissions and connected services will have clear explanations and revocation controls.")
        Spacer(Modifier.weight(1f))
        PreviewNotice()
    }
}

@Composable
fun AutomationScreen(modifier: Modifier = Modifier) {
    var name by remember { mutableStateOf("") }
    var saved by remember { mutableStateOf(false) }
    Page(modifier) {
        BrandHeader()
        Spacer(Modifier.height(25.dp))
        Text("Automation Studio", color = Ink, fontSize = 26.sp, fontWeight = FontWeight.Bold)
        Text("Design routines that work the way you do.", color = Color(0xFF617168))
        Spacer(Modifier.height(18.dp))
        Text("NEW WORKFLOW", color = Forest, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.3.sp)
        OutlinedTextField(value = name, onValueChange = { name = it; saved = false }, modifier = Modifier.fillMaxWidth(), label = { Text("Workflow name") }, placeholder = { Text("e.g. Morning checklist") }, singleLine = true)
        Spacer(Modifier.height(12.dp))
        InfoCard("1 · Choose a trigger", "Schedule · Manual · Approved webhook")
        InfoCard("2 · Add conditions", "Define when your workflow should continue.")
        InfoCard("3 · Choose actions", "Send a notification · Create a task · Approved webhook")
        Spacer(Modifier.height(14.dp))
        Button(onClick = { saved = name.isNotBlank() }, enabled = name.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("Save draft") }
        if (saved) Text("Draft preview created locally. It has not been sent to a server.", color = Forest, fontSize = 12.sp)
        Spacer(Modifier.weight(1f))
        PreviewNotice()
    }
}

@Composable
fun SocialScreen(modifier: Modifier = Modifier) {
    Page(modifier) {
        BrandHeader()
        Spacer(Modifier.height(25.dp))
        Text("Social Intelligence", color = Ink, fontSize = 26.sp, fontWeight = FontWeight.Bold)
        Text("Useful insight from accounts and sources you are authorised to monitor.", color = Color(0xFF617168))
        Spacer(Modifier.height(20.dp))
        InfoCard("Connected accounts", "No accounts connected. Official provider authorisation will be added in a later integration stage.")
        InfoCard("Brand monitoring", "Track permitted public mentions, campaign announcements and new posts.")
        InfoCard("Alerts and reports", "Your future activity feed will collect relevant updates in one place.")
        Spacer(Modifier.weight(1f))
        PreviewNotice()
    }
}

@Composable
fun InfoCard(title: String, description: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 5.dp).background(Color.White, RoundedCornerShape(16.dp)).padding(16.dp)) {
        Text(title, color = Ink, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        Spacer(Modifier.height(5.dp))
        Text(description, color = Color(0xFF69766F), fontSize = 12.sp, lineHeight = 17.sp)
    }
}

@Composable
fun PreviewNotice() {
    Text("PREVIEW ONLY · NO ACCOUNT OR DEVICE DATA CONNECTED", color = Color(0xFF7B827E), fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = .6.sp)
}
